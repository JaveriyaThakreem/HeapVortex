package com.infotact.heapvortex.controller;

import com.infotact.heapvortex.model.HeapEdge;
import com.infotact.heapvortex.model.HeapNode;
import com.infotact.heapvortex.model.HeapSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api")
public class HeapController {
    private static final int NODE_COUNT = 10_000;

    @GetMapping("/health")
    public String health() {
        return "HeapVortex backend is running";
    }

    @GetMapping("/heap")
    public HeapSnapshot getHeapSnapshot() {
        List<HeapNode> nodes = new ArrayList<>(NODE_COUNT);
        List<HeapEdge> edges = new ArrayList<>(NODE_COUNT - 1);

        String[] classes = {
            "java.util.HashMap$Node", "byte[]", "java.lang.String",
            "java.util.ArrayList", "com.demo.UserSession", "com.demo.CacheEntry",
            "java.lang.Thread", "com.demo.ReportBuilder"
        };
        String[] labels = {
            "HashMap$Node", "byte[]", "String", "ArrayList",
            "UserSession", "CacheEntry", "Thread", "ReportBuilder"
        };
        String[] categories = {
            "maps", "arrays", "strings", "collections",
            "objects", "maps", "threads", "objects"
        };

        // Fibonacci-sphere distribution makes the graph fill a rounded 3D volume.
        for (int i = 0; i < NODE_COUNT; i++) {
            double y = 1.0 - (2.0 * i / (NODE_COUNT - 1.0));
            double radius = Math.sqrt(Math.max(0.0, 1.0 - y * y));
            double theta = Math.PI * (3.0 - Math.sqrt(5.0)) * i;
            double x = Math.cos(theta) * radius * 92.0;
            double z = Math.sin(theta) * radius * 92.0;
            y *= 92.0;

            int type = Math.floorMod(i * 17 + 3, classes.length);
            long shallow = 64L + Math.floorMod(i * 7919L, 12_000L);
            long retained = shallow + Math.floorMod(i * 3571L, 48_000L);
            String id = "obj-" + i;
            String label = i == 5997 ? "HashMap$Node#5997" : labels[type] + "#" + i;

            nodes.add(new HeapNode(id, classes[type], label, shallow, retained,
                    round(x), round(y), round(z), categories[type]));

            if (i > 0) {
                int parent = (i - 1) / 2;
                edges.add(new HeapEdge("obj-" + parent, id, "reference"));
            }
        }

        // These are clearly marked sample values, not measurements from a live JVM.
        return new HeapSnapshot("SIMULATED SNAPSHOT · 10,000 OBJECTS",
                322_122_547L, 2_147_483_648L, NODE_COUNT, nodes, edges);
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
