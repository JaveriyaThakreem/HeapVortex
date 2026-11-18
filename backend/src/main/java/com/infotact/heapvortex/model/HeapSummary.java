package com.infotact.heapvortex.model;

/**
 * Lightweight summary of heap snapshot metadata — returned by /api/summary
 * so clients can check sizes before fetching the full 10,000-node snapshot.
 */
public class HeapSummary {
    private final int    totalNodes;
    private final int    totalEdges;
    private final long   usedHeapBytes;
    private final long   maxHeapBytes;
    private final String label;

    public HeapSummary(int totalNodes, int totalEdges,
                       long usedHeapBytes, long maxHeapBytes, String label) {
        this.totalNodes    = totalNodes;
        this.totalEdges    = totalEdges;
        this.usedHeapBytes = usedHeapBytes;
        this.maxHeapBytes  = maxHeapBytes;
        this.label         = label;
    }

    public int    getTotalNodes()    { return totalNodes; }
    public int    getTotalEdges()    { return totalEdges; }
    public long   getUsedHeapBytes() { return usedHeapBytes; }
    public long   getMaxHeapBytes()  { return maxHeapBytes; }
    public String getLabel()         { return label; }
}
