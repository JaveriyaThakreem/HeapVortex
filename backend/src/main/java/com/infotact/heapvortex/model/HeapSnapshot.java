package com.infotact.heapvortex.model;

import java.util.List;

public record HeapSnapshot(
    String source, long usedHeapBytes, long maxHeapBytes,
    int objectCount, List<HeapNode> nodes, List<HeapEdge> edges
) {}
