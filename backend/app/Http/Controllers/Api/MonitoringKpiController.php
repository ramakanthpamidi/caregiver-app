<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MonitoringKpiService;
use App\Support\CoreGridAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MonitoringKpiController extends Controller
{
    public function __construct(protected MonitoringKpiService $kpis) {}

    /**
     * Admin KPI payload for the monitoring room.
     */
    public function __invoke(Request $request): JsonResponse
    {
        CoreGridAccess::assertAdmin($request->user());

        return response()->json($this->kpis->build($request));
    }
}
