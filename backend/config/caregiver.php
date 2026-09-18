<?php

return [
    /*
    | When true, OAuth tokens that fail remote verification are still accepted
    | in a deterministic local-dev way. Also enables "dev:email" token shorthand.
    */
    'oauth_dev_mode' => env('OAUTH_DEV_MODE', true),

    /*
    | When true, POST /users requires email verification before login tokens.
    | Local default is false so the app can log in immediately after signup.
    */
    'require_email_verification' => env('REQUIRE_EMAIL_VERIFICATION', false),

    /*
    | PostgreSQL core_grid dump: medical alerts / events / monitoring KPI.
    */
    'core_grid' => [
        'enabled' => env('CORE_GRID_ENABLED', true),
        'caregiver_app_ids' => [5, 6],
        'caregiver_app_codes' => ['CaregiverMobile', 'CaregiverSite'],
        'admin_membership_roles' => ['SuperAdmin', 'AppAdmin'],
        'admin_laravel_roles' => ['super_admin', 'admin'],
    ],
];
