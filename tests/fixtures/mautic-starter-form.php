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

$alias = 'professionallicensingrequestrelaytest';
$model = $container->get('mautic.form.model.form');
$form = $model->getRepository()->findOneBy(['alias' => $alias]);
if (!$form) {
    $form = new Mautic\FormBundle\Entity\Form();
    $form->setName('Professional licensing starter request test');
    $form->setAlias($alias);
    $form->setIsPublished(true);
    $form->setInKioskMode(true);
    $form->setPostAction('message');
    $form->setPostActionProperty('Request received.');
    $form->setNoIndex(true);
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
}
if (!$form->getInKioskMode() || count($form->getActions()) !== 0) {
    throw new RuntimeException('Fixture must use kiosk mode with no actions.');
}
$result = ['formId' => $form->getId(), 'kiosk' => true, 'actions' => 0, 'mailDisabled' => true];
if (getenv('STARTER_FIXTURE_STATS') === '1') {
    $em = $container->get('doctrine.orm.entity_manager');
    $db = $em->getConnection();
    $table = fn ($class) => $db->quoteIdentifier($em->getClassMetadata($class)->getTableName());
    $leads = $table(Mautic\LeadBundle\Entity\Lead::class);
    $devices = $table(Mautic\LeadBundle\Entity\LeadDevice::class);
    $submissions = $table(Mautic\FormBundle\Entity\Submission::class);
    $prefix = substr($em->getClassMetadata(Mautic\FormBundle\Entity\Form::class)->getTableName(), 0, -strlen('forms'));
    $results = $db->quoteIdentifier($prefix.'form_results_'.$form->getId().'_'.$form->getAlias());
    $result['contacts'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $leads WHERE email IS NOT NULL AND email <> ''");
    $result['anonymous'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $leads WHERE email IS NULL OR email = ''");
    $result['devices'] = (int) $db->fetchOne("SELECT COUNT(*) FROM $devices");
    $result['pageHits'] = (int) $db->fetchOne('SELECT COUNT(*) FROM '.$table(Mautic\PageBundle\Entity\Hit::class));
    $result['emailStats'] = (int) $db->fetchOne('SELECT COUNT(*) FROM '.$table(Mautic\EmailBundle\Entity\Stat::class));
    $result['submissions'] = $db->fetchAllAssociative("SELECT r.*, s.lead_id, s.tracking_id FROM $results r JOIN $submissions s ON s.id = r.submission_id ORDER BY r.submission_id");
}
echo json_encode($result, JSON_THROW_ON_ERROR).PHP_EOL;
