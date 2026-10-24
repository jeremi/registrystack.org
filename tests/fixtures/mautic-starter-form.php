<?php
// Local Mautic 7.2.1 acceptance fixture. Never run against the live instance.
require '/var/www/html/vendor/autoload.php';
$_SERVER['APP_ENV'] = 'prod';
$_SERVER['APP_DEBUG'] = '0';
$application = require '/var/www/html/docroot/app/console-application.php';
$kernel = $application->getKernel();
$kernel->boot();
$container = $kernel->getContainer();
$core = $container->get('mautic.helper.core_parameters');
if (parse_url($core->get('site_url'), PHP_URL_HOST) !== '127.0.0.1' || $core->get('mailer_dsn') !== 'null://null') {
    throw new RuntimeException('Fixture requires a local Mautic instance with mail disabled.');
}

$fieldModel = $container->get('mautic.lead.model.field');
$emailField = $fieldModel->getRepository()->findOneBy(['object' => 'lead', 'alias' => 'email']);
if (!$emailField instanceof Mautic\LeadBundle\Entity\LeadField || $emailField->getObject() !== 'lead' ||
    $emailField->getAlias() !== 'email' || $emailField->getType() !== 'email' || !$emailField->getIsFixed()) {
    throw new RuntimeException('Fixture requires the fixed Contact email field.');
}
$emailWasPubliclyUpdatable = (bool) $emailField->getIsPubliclyUpdatable();
if ($emailWasPubliclyUpdatable) {
    $emailField->setIsPubliclyUpdatable(false);
    $fieldModel->getRepository()->saveEntity($emailField);
}
if ($emailField->getIsPubliclyUpdatable()) {
    throw new RuntimeException('Contact email must not be publicly updatable.');
}

$model = $container->get('mautic.form.model.form');
$fields = [
    ['email', 'Email', 'email', true, 'email', null],
    ['organization', 'Organization', 'text', false, null, null],
    ['role', 'Your role', 'text', false, null, null],
    ['message', 'What are you trying to do?', 'textarea', false, null, null],
    ['starter_id', 'Starter', 'hidden', true, null, 'professional-licensing'],
    ['source_page', 'Source page', 'hidden', true, null, '/starters/professional-licensing/'],
    ['request_token', 'Request reference', 'hidden', true, null, null],
    ['website', 'Leave this empty', 'captcha', false, null, null],
];
$ensureForm = function ($alias, $name, $kiosk) use ($model, $fields) {
    $form = $model->getRepository()->findOneBy(['alias' => $alias]);
    if ($form) {
        return $form;
    }
    $form = new Mautic\FormBundle\Entity\Form();
    $form->setName($name);
    $form->setAlias($alias);
    $form->setIsPublished(true);
    $form->setInKioskMode($kiosk);
    $form->setPostAction('message');
    $form->setPostActionProperty('Request received.');
    $form->setNoIndex(true);
    foreach ($fields as $index => [$name, $label, $type, $required, $contactField, $default]) {
        $field = new Mautic\FormBundle\Entity\Field();
        $field->setAlias($name)->setLabel($label)->setType($type)->setIsRequired($required)->setOrder($index + 1)->setForm($form);
        $field->setSaveResult($name !== 'website');
        $field->setIsAutoFill(false);
        $field->setDefaultValue($default);
        if ($contactField) {
            $field->setMappedObject('contact');
            $field->setMappedField($contactField);
        }
        if ($type === 'captcha') $field->setProperties(['captcha' => '']);
        $form->addField($index, $field);
    }
    $model->saveEntity($form);
    return $form;
};
$form = $ensureForm('professionallicensingrequestrelaytest', 'Professional licensing starter request test', true);
$trackedForm = $ensureForm('professionallicensingrequesttrackedtest', 'Professional licensing tracked starter request test', false);
$validateForm = function ($candidate, $expectedKiosk) use ($fields) {
    if ((bool) $candidate->getInKioskMode() !== $expectedKiosk || count($candidate->getActions()) !== 0) {
        throw new RuntimeException('Fixture forms must use the expected kiosk mode with no actions.');
    }
    $actual = [];
    foreach ($candidate->getFields() as $field) {
        $actual[$field->getAlias()] = $field;
    }
    if (array_keys($actual) !== array_column($fields, 0)) {
        throw new RuntimeException('Fixture forms must have identical ordered fields.');
    }
    foreach ($actual as $alias => $field) {
        $mapped = $field->getMappedObject() || $field->getMappedField();
        if (($alias === 'email' && (!$field->getSaveResult() || $field->getMappedObject() !== 'contact' || $field->getMappedField() !== 'email')) ||
            ($alias !== 'email' && $mapped) || ($alias === 'website' && $field->getSaveResult()) ||
            ($alias !== 'website' && !$field->getSaveResult()) || $field->getIsAutoFill()) {
            throw new RuntimeException('Fixture form fields do not match the acceptance contract.');
        }
    }
};
$validateForm($form, true);
$validateForm($trackedForm, false);

$mauticSiteUrl = getenv('STARTER_FIXTURE_MAUTIC_URL') ?: null;
$websiteOrigin = getenv('STARTER_FIXTURE_WEBSITE_ORIGIN') ?: null;
if (($mauticSiteUrl === null) !== ($websiteOrigin === null)) {
    throw new RuntimeException('Both fixture origins are required together.');
}
if ($mauticSiteUrl !== null) {
    $mauticParts = parse_url($mauticSiteUrl);
    $websiteParts = parse_url($websiteOrigin);
    if (($mauticParts['scheme'] ?? null) !== 'https' || ($mauticParts['host'] ?? null) !== '127.0.0.1' ||
        ($mauticParts['path'] ?? '') !== '' || isset($mauticParts['query']) || isset($mauticParts['fragment']) ||
        isset($mauticParts['user']) || isset($mauticParts['pass']) ||
        !in_array($websiteParts['scheme'] ?? null, ['http', 'https'], true) || ($websiteParts['host'] ?? null) !== '127.0.0.1' ||
        ($websiteParts['path'] ?? '') !== '' || isset($websiteParts['query']) || isset($websiteParts['fragment']) ||
        isset($websiteParts['user']) || isset($websiteParts['pass'])) {
        throw new RuntimeException('Fixture origins must be isolated loopback URLs.');
    }
    $configurator = $container->get('mautic.configurator');
    $configurator->mergeParameters([
        'site_url' => $mauticSiteUrl,
        'cors_restrict_domains' => true,
        'cors_valid_domains' => [$websiteOrigin],
        'anonymize_ip' => true,
        'track_contact_by_ip' => false,
        'track_private_ip_ranges' => true,
    ]);
    $configurator->write();
}

$result = [
    'formId' => $form->getId(),
    'trackedFormId' => $trackedForm->getId(),
    'kiosk' => true,
    'trackedKiosk' => false,
    'actions' => 0,
    'mailDisabled' => true,
    'emailPubliclyUpdatable' => false,
    'emailWasPubliclyUpdatable' => $emailWasPubliclyUpdatable,
];
if (getenv('STARTER_FIXTURE_STATS') === '1') {
    $em = $container->get('doctrine.orm.entity_manager');
    $db = $em->getConnection();
    $table = fn ($class) => $db->quoteIdentifier($em->getClassMetadata($class)->getTableName());
    $leads = $table(Mautic\LeadBundle\Entity\Lead::class);
    $devices = $table(Mautic\LeadBundle\Entity\LeadDevice::class);
    $submissions = $table(Mautic\FormBundle\Entity\Submission::class);
    $prefix = substr($em->getClassMetadata(Mautic\FormBundle\Entity\Form::class)->getTableName(), 0, -strlen('forms'));
    $resultRows = function ($candidate) use ($db, $prefix, $submissions) {
        $results = $db->quoteIdentifier($prefix.'form_results_'.$candidate->getId().'_'.$candidate->getAlias());
        $rows = $db->fetchAllAssociative("SELECT r.*, s.lead_id, s.tracking_id FROM $results r JOIN $submissions s ON s.id = r.submission_id ORDER BY r.submission_id");
        foreach ($rows as &$row) {
            $row['form_id'] = $candidate->getId();
        }
        return $rows;
    };
    $result['contacts'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $leads WHERE email IS NOT NULL AND email <> ''");
    $result['anonymous'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $leads WHERE email IS NULL OR email = ''");
    $result['devices'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $devices");
    $result['pageHits'] = (int) $db->fetchOne('SELECT COUNT(*) FROM '.$table(Mautic\PageBundle\Entity\Hit::class));
    $hitRows = $db->fetchAllAssociative('SELECT id, lead_id, url, tracking_id, query FROM '.$table(Mautic\PageBundle\Entity\Hit::class).' ORDER BY id');
    $reportedQueryFields = array_flip(['page_url', 'page_referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
    foreach ($hitRows as &$hitRow) {
        $query = $hitRow['query'] ? unserialize($hitRow['query'], ['allowed_classes' => false]) : [];
        if (!is_array($query)) {
            throw new RuntimeException('Stored page-hit query is malformed.');
        }
        $hitRow['query_fields'] = array_intersect_key($query, $reportedQueryFields);
        unset($hitRow['query']);
    }
    $result['hitRows'] = $hitRows;
    $result['deviceRows'] = $db->fetchAllAssociative("SELECT id, lead_id, tracking_id FROM $devices ORDER BY id");
    $result['emailStats'] = (int) $db->fetchOne('SELECT COUNT(*) FROM '.$table(Mautic\EmailBundle\Entity\Stat::class));
    $result['submissions'] = array_merge($resultRows($form), $resultRows($trackedForm));
    usort($result['submissions'], fn ($a, $b) => $a['submission_id'] <=> $b['submission_id']);
}
echo json_encode($result, JSON_THROW_ON_ERROR).PHP_EOL;
