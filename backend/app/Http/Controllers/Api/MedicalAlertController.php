<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\CoreGridAccess;
use App\Support\MedicalAlertQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicalAlertController extends Controller
{
    public function __construct(protected MedicalAlertQuery $query) {}

    /**
     * User: alerts for granted profiles only.
     * Admin: every core_grid medical alert.
     */
    public function index(Request $request): JsonResponse
    {
        $page = $this->query->eventsFor($request->user(), $request);

        return response()->json([
            'scope' => CoreGridAccess::isAdmin($request->user()) ? 'admin' : 'user',
            'events' => $page->getCollection()->map->toAlert()->values(),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $event = $this->query->findVisibleEvent($request->user(), $id);
        if (!$event) {
            return response()->json([
                'error' => 'Alert not found',
                'message' => 'Alert not found',
            ], 404);
        }

        return response()->json([
            'event' => $event->toAlert(),
        ]);
    }

    /**
     * User-wise medical readings (core_grid medical_data_raw).
     */
    public function records(Request $request): JsonResponse
    {
        $page = $this->query->readingsFor($request->user(), $request);

        return response()->json([
            'scope' => CoreGridAccess::isAdmin($request->user()) ? 'admin' : 'user',
            'rows' => $page->getCollection()->map->toRow()->values(),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * Admin-only unscoped alert list for the monitoring room.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        CoreGridAccess::assertAdmin($request->user());

        return $this->index($request);
    }
}
