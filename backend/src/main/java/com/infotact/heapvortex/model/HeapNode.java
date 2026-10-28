package com.infotact.heapvortex.model;

public record HeapNode(
    String id, String className, String label,
    long shallowSizeBytes, long retainedSizeBytes,
    double x, double y, double z, String category
) {}
