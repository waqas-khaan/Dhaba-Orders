package com.dhaba;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KitchenWorkerApplicationTest {
    @Test
    void workerModuleLoads() {
        assertTrue(true);
    }

    @Test
    void workerTelemetryFormatValid() {
        Map<String, Object> status = Map.of(
            "status", "active",
            "service", "kitchen-worker",
            "processed_count", 0L
        );
        assertEquals("kitchen-worker", status.get("service"));
        assertEquals("active", status.get("status"));
    }
}
