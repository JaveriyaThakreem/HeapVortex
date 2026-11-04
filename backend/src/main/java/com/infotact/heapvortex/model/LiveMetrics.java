package com.infotact.heapvortex.model;

import java.util.List;

public record LiveMetrics(
    long usedHeapBytes,
    long maxHeapBytes,
    int gcCount,
    int threadCount,
    long uptimeSeconds,
    List<GcEvent> recentGcEvents,
    List<TopObject> topObjects
) {}
