<?php
// Local Mautic 7.2.1 shared-tracking acceptance fixture. Never run against a live instance.
require '/var/www/html/vendor/autoload.php';
$_SERVER['APP_ENV'] = 'prod';
$_SERVER['APP_DEBUG'] = '0';
$application = require '/var/www/html/docroot/app/console-application.php';
$kernel = $application->getKernel();
$kernel->boot();
$container = $kernel->getContainer();
$core = $container->get('mautic.helper.core_parameters');
$isLoopback = function ($host) {
    return $host === 'localhost' ||
        (is_string($host) && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false && explode('.', $host)[0] === '127');
};
if (!$isLoopback(parse_url($core->get('site_url'), PHP_URL_HOST)) || $core->get('mailer_dsn') !== 'null://null') {
    throw new RuntimeException('Fixture requires a loopback Mautic instance with mail disabled.');
}

$fieldModel = $container->get('mautic.lead.model.field');
$emailField = $fieldModel->getRepository()->findOneBy(['object' => 'lead', 'alias' => 'email']);
if (!$emailField instanceof Mautic\LeadBundle\Entity\LeadField || $emailField->getType() !== 'email' || !$emailField->getIsFixed()) {
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
    ['starter_id', 'Starter', 'hidden', false, null, ''],
    ['source_page', 'Source page', 'hidden', true, null, ''],
    ['request_token', 'Request reference', 'hidden', true, null, null],
    ['request_type', 'Request type', 'hidden', false, null, ''],
    ['request_context', 'Request context', 'hidden', false, null, ''],
    ['website', 'Leave this empty', 'captcha', false, null, null],
];
$ensureForm = function ($alias, $name, $kiosk) use ($model, $fields) {
    $form = $model->getRepository()->findOneBy(['alias' => $alias]);
    if (!$form) {
        $form = new Mautic\FormBundle\Entity\Form();
        $form->setAlias($alias);
    }
    $form->setName($name);
    $form->setIsPublished(true);
    $form->setInKioskMode($kiosk);
    $form->setPostAction('message');
    $form->setPostActionProperty('Request received.');
    $form->setNoIndex(true);
    if (count($form->getActions()) !== 0) {
        throw new RuntimeException('Fixture forms must not have actions.');
    }
    $actual = [];
    foreach ($form->getFields() as $field) {
        $actual[$field->getAlias()] = $field;
    }
    if (array_diff(array_keys($actual), array_column($fields, 0)) !== []) {
        throw new RuntimeException('Fixture form contains an unmanaged field.');
    }
    foreach ($fields as $index => [$name, $label, $type, $required, $contactField, $default]) {
        $field = $actual[$name] ?? new Mautic\FormBundle\Entity\Field();
        $field->setAlias($name)->setLabel($label)->setType($type)->setIsRequired($required)->setOrder($index + 1)->setForm($form);
        $field->setSaveResult($name !== 'website');
        $field->setIsAutoFill(false);
        $field->setDefaultValue($default);
        if ($contactField) {
            $field->setMappedObject('contact');
            $field->setMappedField($contactField);
        } else {
            $field->setMappedObject(null);
            $field->setMappedField(null);
        }
        $field->setProperties($type === 'captcha' ? ['captcha' => ''] : []);
        if (!isset($actual[$name])) {
            $form->addField($index, $field);
        }
    }
    $model->saveEntity($form);
    return $form;
};
$kioskForm = $ensureForm('sharedtrackingkiosktest', 'Shared tracking request (unlinked) test', true);
$trackedForm = $ensureForm('sharedtrackingconsentedtest', 'Shared tracking request (consented) test', false);
$validateForm = function ($candidate, $expectedKiosk) use ($fields) {
    if ((bool) $candidate->getInKioskMode() !== $expectedKiosk || count($candidate->getActions()) !== 0) {
        throw new RuntimeException('Fixture forms must use the expected kiosk mode with no actions.');
    }
    $actual = [];
    foreach ($candidate->getFields() as $field) {
        $actual[$field->getAlias()] = $field;
    }
    uasort($actual, fn ($left, $right) => $left->getOrder() <=> $right->getOrder());
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
$validateForm($kioskForm, true);
$validateForm($trackedForm, false);

$mauticSiteUrl = getenv('SHARED_FIXTURE_MAUTIC_URL') ?: null;
$encodedOrigins = getenv('SHARED_FIXTURE_WEBSITE_ORIGINS') ?: null;
if (($mauticSiteUrl === null) !== ($encodedOrigins === null)) {
    throw new RuntimeException('The Mautic URL and website origins are required together.');
}
if ($mauticSiteUrl !== null) {
    $origins = json_decode($encodedOrigins, true, 8, JSON_THROW_ON_ERROR);
    $mauticParts = parse_url($mauticSiteUrl);
    if (!is_array($origins) || count($origins) !== 2 || count(array_unique($origins)) !== 2 ||
        ($mauticParts['scheme'] ?? null) !== 'https' || !$isLoopback($mauticParts['host'] ?? null) ||
        ($mauticParts['path'] ?? '') !== '' || isset($mauticParts['query']) || isset($mauticParts['fragment']) ||
        isset($mauticParts['user']) || isset($mauticParts['pass'])) {
        throw new RuntimeException('Fixture requires one isolated Mautic origin and two website origins.');
    }
    foreach ($origins as $origin) {
        $parts = is_string($origin) ? parse_url($origin) : false;
        if (!is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || !$isLoopback($parts['host'] ?? null) ||
            ($parts['path'] ?? '') !== '' || isset($parts['query']) || isset($parts['fragment']) ||
            isset($parts['user']) || isset($parts['pass'])) {
            throw new RuntimeException('Website origins must be distinct HTTPS loopback origins.');
        }
    }
    $configurator = $container->get('mautic.configurator');
    $configurator->mergeParameters([
        'site_url' => $mauticSiteUrl,
        'cors_restrict_domains' => true,
        'cors_valid_domains' => $origins,
        'anonymize_ip' => true,
        'track_contact_by_ip' => false,
        'track_private_ip_ranges' => true,
    ]);
    $configurator->write();
}

$result = [
    'kioskFormId' => $kioskForm->getId(),
    'trackedFormId' => $trackedForm->getId(),
    'kiosk' => true,
    'trackedKiosk' => false,
    'actions' => count($kioskForm->getActions()) + count($trackedForm->getActions()),
    'mailDisabled' => true,
    'emailPubliclyUpdatable' => false,
    'emailWasPubliclyUpdatable' => $emailWasPubliclyUpdatable,
];
if (getenv('SHARED_FIXTURE_STATS') === '1') {
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
    $reportedQueryFields = array_flip(['page_url', 'page_referrer', 'page_title', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
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
    $result['campaigns'] = (int) $db->fetchOne('SELECT COUNT(*) FROM '.$table(Mautic\CampaignBundle\Entity\Campaign::class));
    $result['submissions'] = array_merge($resultRows($kioskForm), $resultRows($trackedForm));
    usort($result['submissions'], fn ($a, $b) => $a['submission_id'] <=> $b['submission_id']);
}
echo json_encode($result, JSON_THROW_ON_ERROR).PHP_EOL;
