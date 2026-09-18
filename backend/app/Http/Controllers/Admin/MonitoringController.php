<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesAdminPermissions;
use App\Http\Controllers\Controller;
use App\Services\MonitoringKpiService;
use App\Support\MedicalAlertQuery;
use Illuminate\Http\Request;

class MonitoringController extends Controller
{
    use AuthorizesAdminPermissions;

    public function __construct(
        protected MonitoringKpiService $kpis,
        protected MedicalAlertQuery $alerts,
    ) {}

    public function index(Request $request)
    {
        $this->authorizePermission('monitoring.kpi.view');

        $kpi = $this->kpis->build($request);
        $alerts = $this->alerts->eventsFor($request->user(), $request);

        return view('admin.monitoring', compact('kpi', 'alerts'));
    }
}
