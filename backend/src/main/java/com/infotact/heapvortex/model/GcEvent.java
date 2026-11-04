package com.infotact.heapvortex.model;

public record GcEvent(
    String id,
    String type,
    long pauseMs,
    String timestamp,
    long freedBytes
) {}
