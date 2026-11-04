package com.infotact.heapvortex.controller;

import com.infotact.heapvortex.model.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api")
public class HeapController {
    private static final int    NODE_COUNT = 10_000;
    private static final long   MAX_HEAP   = 2_147_483_648L; // 2 GB
    private static final long   CYCLE_MS   = 42_000L;        // 42-second sawtooth GC cycle
    // A fixed past epoch so "uptime" looks realistic across requests
    private static final long   FAKE_START = 1_735_000_000_000L;

    // ── Static heap snapshot (loaded once by the frontend) ─────────────────
    @GetMapping("/health")
    public String health() {
        return "HeapVortex backend is running";
    }

    @GetMapping("/heap")
    public HeapSnapshot getHeapSnapshot() {
        List<HeapNode> nodes = new ArrayList<>(NODE_COUNT);
        List<HeapEdge> edges = new ArrayList<>(NODE_COUNT - 1);

        String[] classes    = { "java.util.HashMap$Node", "byte[]", "java.lang.String",
                                "java.util.ArrayList", "com.demo.UserSession", "com.demo.CacheEntry",
                                "java.lang.Thread", "com.demo.ReportBuilder" };
        String[] labels     = { "HashMap$Node", "byte[]", "String", "ArrayList",
                                "UserSession", "CacheEntry", "Thread", "ReportBuilder" };
        String[] categories = { "maps", "arrays", "strings", "collections",
                                "objects", "maps", "threads", "objects" };

        // Fibonacci-sphere distribution fills a rounded 3-D volume evenly.
        for (int i = 0; i < NODE_COUNT; i++) {
            double y      = 1.0 - (2.0 * i / (NODE_COUNT - 1.0));
            double radius = Math.sqrt(Math.max(0.0, 1.0 - y * y));
            double theta  = Math.PI * (3.0 - Math.sqrt(5.0)) * i;
            double x      = Math.cos(theta) * radius * 92.0;
            double z      = Math.sin(theta) * radius * 92.0;
            y *= 92.0;

            int    type     = Math.floorMod(i * 17 + 3, classes.length);
            long   shallow  = 64L  + Math.floorMod(i * 7919L, 12_000L);
            long   retained = shallow + Math.floorMod(i * 3571L, 48_000L);
            String id       = "obj-" + i;
            String label    = (i == 5997) ? "HashMap$Node#5997" : labels[type] + "#" + i;

            nodes.add(new HeapNode(id, classes[type], label, shallow, retained,
                    round(x), round(y), round(z), categories[type]));

            if (i > 0) {
                int parent = (i - 1) / 2;
                edges.add(new HeapEdge("obj-" + parent, id, "reference"));
            }
        }

        return new HeapSnapshot("SIMULATED SNAPSHOT · 10,000 OBJECTS",
                322_122_547L, MAX_HEAP, NODE_COUNT, nodes, edges);
    }

    // ── Live metrics — polled every few seconds by the frontend ────────────
    @GetMapping("/live")
    public LiveMetrics getLiveMetrics() {
        long now = System.currentTimeMillis();

        // Sawtooth: heap climbs from 38 % → 83 % over one cycle, then GC resets it.
        long   phase = now % CYCLE_MS;
        double t     = (double) phase / CYCLE_MS;
        double base  = 0.38 + 0.45 * t;
        // Micro-noise — two slow sine waves simulate allocation bursts.
        double noise = Math.sin(now * 0.00131) * 0.016 + Math.cos(now * 0.00071) * 0.011;
        double ratio = Math.max(0.36, Math.min(0.86, base + noise));
        long   usedHeap = (long) (MAX_HEAP * ratio);

        // Total completed cycles → used as a proxy for cumulative GC count.
        long totalCycles = now / CYCLE_MS;
        int  gcCount     = (int) (Math.floorMod(totalCycles * 2 + (t > 0.5 ? 1 : 0), 100_000));

        // Thread count oscillates gently between 20 and 32.
        int  threads     = 26 + (int) (Math.sin(now * 0.000083) * 6);

        // Uptime in seconds (wraps daily — purely cosmetic).
        long uptimeSec   = (now - FAKE_START) / 1000 % 86_400;

        // ── GC event history (newest first) ────────────────────────────────
        List<GcEvent> events = new ArrayList<>();
        for (int i = 0; events.size() < 6; i++) {
            long   cycleIdx  = totalCycles - i / 2;
            boolean isOld    = (i % 2 == 1);
            double  evPhase  = isOld ? 0.72 : 0.28;
            long    evTime   = cycleIdx * CYCLE_MS + (long) (CYCLE_MS * evPhase);
            if (evTime >= now) continue; // event hasn't happened yet

            long seed    = cycleIdx * 1_000L + (isOld ? 500 : 0);
            long pause   = isOld
                    ? 40 + Math.floorMod(seed * 3571L, 22)
                    : 12 + Math.floorMod(seed * 7919L, 12);
            double freed = isOld
                    ? 0.28 + Math.floorMod(seed * 1234L, 8) * 0.01
                    : 0.12 + Math.floorMod(seed * 5678L, 5) * 0.01;

            events.add(new GcEvent(
                    "gc-" + (totalCycles * 2 - events.size()),
                    isOld ? "G1 Old GC" : "G1 Young GC",
                    pause,
                    fmtTime(evTime),
                    (long) (MAX_HEAP * freed)
            ));
        }

        // ── Top objects — tiny variance per 3-second tick ──────────────────
        long tick = now / 3_000;
        long v    = tick * 1_337L;
        List<TopObject> top = List.of(
                new TopObject("byte[]",
                        (int) (24_891 + Math.floorMod(v, 301) - 150),
                        87_234_560L + Math.floorMod(v * 7L, 500_001) - 250_000),
                new TopObject("java.lang.String",
                        (int) (18_234 + Math.floorMod(v, 201) - 100),
                        42_118_144L + Math.floorMod(v * 11L, 300_001) - 150_000),
                new TopObject("com.demo.CacheEntry",
                        (int) (1_204 + Math.floorMod(v, 21) - 10),
                        38_912_000L + Math.floorMod(v * 13L, 200_001) - 100_000),
                new TopObject("java.util.HashMap$Node",
                        (int) (9_867 + Math.floorMod(v, 151) - 75),
                        31_457_280L + Math.floorMod(v * 17L, 400_001) - 200_000),
                new TopObject("com.demo.UserSession",
                        (int) (342  + Math.floorMod(v, 11) - 5),
                        28_311_552L + Math.floorMod(v * 19L, 100_001) - 50_000),
                new TopObject("java.util.ArrayList",
                        (int) (5_612 + Math.floorMod(v, 81) - 40),
                        17_825_792L + Math.floorMod(v * 23L, 200_001) - 100_000)
        );

        return new LiveMetrics(usedHeap, MAX_HEAP, gcCount, threads, uptimeSec, events, top);
    }

    // ── helpers ────────────────────────────────────────────────────────────
    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String fmtTime(long epochMs) {
        return ZonedDateTime
                .ofInstant(Instant.ofEpochMilli(epochMs), ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("HH:mm:ss"));
    }
}
