package com.infotact.heapvortex.model;

public record TopObject(
    String className,
    int instances,
    long totalRetainedBytes
) {}
