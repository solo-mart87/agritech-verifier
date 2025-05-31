import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state
const mockContract = {
  precisionTools: new Map(),
  toolBySerial: new Map(),
  calibrationRecords: new Map(),
  toolCalibrationCount: new Map(),
  performanceMetrics: new Map(),
  toolMetricCount: new Map(),
  authorizedCalibrators: new Map(),
  nextToolId: 1,
  contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  currentSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 1000,
};

// Mock contract functions
function registerTool(name, toolType, manufacturer, model, serialNumber) {
  const toolId = mockContract.nextToolId;

  // Check if serial number already exists
  if (mockContract.toolBySerial.has(serialNumber)) {
    return { error: "already-exists" };
  }

  // Validate inputs
  if (!name || !toolType || !manufacturer || !model || !serialNumber) {
    return { error: "invalid-input" };
  }

  const tool = {
    name,
    toolType,
    manufacturer,
    model,
    serialNumber,
    owner: mockContract.currentSender,
    certified: false,
    certificationDate: 0,
    lastCalibration: 0,
    status: "registered",
  };

  mockContract.precisionTools.set(toolId, tool);
  mockContract.toolBySerial.set(serialNumber, toolId);
  mockContract.toolCalibrationCount.set(toolId, 0);
  mockContract.toolMetricCount.set(toolId, 0);
  mockContract.nextToolId++;

  return { success: toolId };
}

function authorizeCalibrator(calibrator) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  mockContract.authorizedCalibrators.set(calibrator, {
    authorized: true,
    authorizationDate: mockContract.blockHeight,
  });

  return { success: true };
}

function calibrateTool(toolId, accuracyScore, notes, passed) {
  const calibratorAuth = mockContract.authorizedCalibrators.get(
    mockContract.currentSender
  );
  if (!calibratorAuth || !calibratorAuth.authorized) {
    return { error: "unauthorized" };
  }

  const tool = mockContract.precisionTools.get(toolId);
  if (!tool) {
    return { error: "not-found" };
  }

  if (accuracyScore > 100) {
    return { error: "invalid-input" };
  }

  const calibrationId = mockContract.toolCalibrationCount.get(toolId) || 0;
  const calibrationKey = `${toolId}-${calibrationId}`;

  mockContract.calibrationRecords.set(calibrationKey, {
    calibrationDate: mockContract.blockHeight,
    calibrator: mockContract.currentSender,
    accuracyScore,
    notes,
    passed,
  });

  mockContract.toolCalibrationCount.set(toolId, calibrationId + 1);

  tool.lastCalibration = mockContract.blockHeight;
  tool.status = passed ? "calibrated" : "needs-calibration";

  return { success: calibrationId };
}

function certifyTool(toolId) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  const tool = mockContract.precisionTools.get(toolId);
  if (!tool) {
    return { error: "not-found" };
  }

  tool.certified = true;
  tool.certificationDate = mockContract.blockHeight;
  tool.status = "certified";

  return { success: true };
}

function recordPerformanceMetric(toolId, metricType, value, unit) {
  const tool = mockContract.precisionTools.get(toolId);
  if (!tool) {
    return { error: "not-found" };
  }

  if (mockContract.currentSender !== tool.owner) {
    return { error: "unauthorized" };
  }

  if (!metricType || !unit) {
    return { error: "invalid-input" };
  }

  const metricId = mockContract.toolMetricCount.get(toolId) || 0;
  const metricKey = `${toolId}-${metricId}`;

  mockContract.performanceMetrics.set(metricKey, {
    metricDate: mockContract.blockHeight,
    metricType,
    value,
    unit,
    recordedBy: mockContract.currentSender,
  });

  mockContract.toolMetricCount.set(toolId, metricId + 1);

  return { success: metricId };
}

function getToolInfo(toolId) {
  return mockContract.precisionTools.get(toolId) || null;
}

function getToolBySerial(serialNumber) {
  const toolId = mockContract.toolBySerial.get(serialNumber);
  return toolId ? mockContract.precisionTools.get(toolId) : null;
}

function getCalibrationRecord(toolId, calibrationId) {
  const calibrationKey = `${toolId}-${calibrationId}`;
  return mockContract.calibrationRecords.get(calibrationKey) || null;
}

function getPerformanceMetric(toolId, metricId) {
  const metricKey = `${toolId}-${metricId}`;
  return mockContract.performanceMetrics.get(metricKey) || null;
}

function isCalibratorAuthorized(calibrator) {
  const auth = mockContract.authorizedCalibrators.get(calibrator);
  return auth ? auth.authorized : false;
}

function isToolCertified(toolId) {
  const tool = mockContract.precisionTools.get(toolId);
  return tool ? tool.certified : false;
}

describe("Precision Tools Contract", () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContract.precisionTools.clear();
    mockContract.toolBySerial.clear();
    mockContract.calibrationRecords.clear();
    mockContract.toolCalibrationCount.clear();
    mockContract.performanceMetrics.clear();
    mockContract.toolMetricCount.clear();
    mockContract.authorizedCalibrators.clear();
    mockContract.nextToolId = 1;
    mockContract.currentSender = mockContract.contractOwner;
    mockContract.blockHeight = 1000;
  });

  describe("Tool Registration", () => {
    it("should register precision tool successfully", () => {
      const result = registerTool(
        "GPS Guidance System",
        "navigation",
        "TrimbleAg",
        "CFX-750",
        "TRI123456789"
      );

      expect(result.success).toBe(1);

      const tool = getToolInfo(1);
      expect(tool.name).toBe("GPS Guidance System");
      expect(tool.toolType).toBe("navigation");
      expect(tool.manufacturer).toBe("TrimbleAg");
      expect(tool.model).toBe("CFX-750");
      expect(tool.serialNumber).toBe("TRI123456789");
      expect(tool.certified).toBe(false);
      expect(tool.status).toBe("registered");
    });

    it("should reject duplicate serial numbers", () => {
      registerTool("Tool 1", "type1", "Manufacturer", "Model1", "SERIAL123");

      const result = registerTool(
        "Tool 2",
        "type2",
        "Manufacturer",
        "Model2",
        "SERIAL123"
      );
      expect(result.error).toBe("already-exists");
    });

    it("should validate input parameters", () => {
      // Empty name
      let result = registerTool("", "type", "manufacturer", "model", "serial");
      expect(result.error).toBe("invalid-input");

      // Empty tool type
      result = registerTool("Tool", "", "manufacturer", "model", "serial");
      expect(result.error).toBe("invalid-input");

      // Empty manufacturer
      result = registerTool("Tool", "type", "", "model", "serial");
      expect(result.error).toBe("invalid-input");

      // Empty model
      result = registerTool("Tool", "type", "manufacturer", "", "serial");
      expect(result.error).toBe("invalid-input");

      // Empty serial number
      result = registerTool("Tool", "type", "manufacturer", "model", "");
      expect(result.error).toBe("invalid-input");
    });
  });

  describe("Calibrator Authorization", () => {
    it("should authorize calibrator by contract owner", () => {
      const calibrator = "ST2CALIBRATOR_ADDRESS";
      const result = authorizeCalibrator(calibrator);
      expect(result.success).toBe(true);

      const authorized = isCalibratorAuthorized(calibrator);
      expect(authorized).toBe(true);
    });

    it("should reject authorization by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = authorizeCalibrator("ST2CALIBRATOR_ADDRESS");
      expect(result.error).toBe("owner-only");
    });
  });

  describe("Tool Calibration", () => {
    beforeEach(() => {
      registerTool("Test Tool", "navigation", "TestCorp", "Model1", "TEST123");
      authorizeCalibrator(mockContract.currentSender);
    });

    it("should calibrate tool by authorized calibrator", () => {
      const result = calibrateTool(1, 95, "Excellent accuracy", true);
      expect(result.success).toBe(0);

      const tool = getToolInfo(1);
      expect(tool.lastCalibration).toBe(mockContract.blockHeight);
      expect(tool.status).toBe("calibrated");

      const calibration = getCalibrationRecord(1, 0);
      expect(calibration.accuracyScore).toBe(95);
      expect(calibration.passed).toBe(true);
    });

    it("should reject calibration by unauthorized calibrator", () => {
      mockContract.currentSender = "ST2UNAUTHORIZED_ADDRESS";

      const result = calibrateTool(1, 95, "Unauthorized calibration", true);
      expect(result.error).toBe("unauthorized");
    });

    it("should validate accuracy score range", () => {
      const result = calibrateTool(1, 150, "Invalid score", true);
      expect(result.error).toBe("invalid-input");
    });

    it("should handle failed calibration", () => {
      const result = calibrateTool(1, 60, "Below threshold", false);
      expect(result.success).toBe(0);

      const tool = getToolInfo(1);
      expect(tool.status).toBe("needs-calibration");
    });
  });

  describe("Tool Certification", () => {
    beforeEach(() => {
      registerTool("Test Tool", "navigation", "TestCorp", "Model1", "TEST123");
    });

    it("should certify tool by contract owner", () => {
      const result = certifyTool(1);
      expect(result.success).toBe(true);

      const tool = getToolInfo(1);
      expect(tool.certified).toBe(true);
      expect(tool.certificationDate).toBe(mockContract.blockHeight);
      expect(tool.status).toBe("certified");
    });

    it("should reject certification by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = certifyTool(1);
      expect(result.error).toBe("owner-only");
    });
  });

  describe("Performance Metrics", () => {
    beforeEach(() => {
      registerTool("Test Tool", "navigation", "TestCorp", "Model1", "TEST123");
    });

    it("should record performance metric by tool owner", () => {
      const result = recordPerformanceMetric(1, "accuracy", 98, "percentage");
      expect(result.success).toBe(0);

      const metric = getPerformanceMetric(1, 0);
      expect(metric.metricType).toBe("accuracy");
      expect(metric.value).toBe(98);
      expect(metric.unit).toBe("percentage");
    });

    it("should reject metric recording by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = recordPerformanceMetric(1, "accuracy", 98, "percentage");
      expect(result.error).toBe("unauthorized");
    });

    it("should validate metric parameters", () => {
      // Empty metric type
      let result = recordPerformanceMetric(1, "", 98, "percentage");
      expect(result.error).toBe("invalid-input");

      // Empty unit
      result = recordPerformanceMetric(1, "accuracy", 98, "");
      expect(result.error).toBe("invalid-input");
    });

    it("should track multiple metrics", () => {
      recordPerformanceMetric(1, "accuracy", 98, "percentage");
      recordPerformanceMetric(1, "speed", 15, "mph");

      expect(mockContract.toolMetricCount.get(1)).toBe(2);
    });
  });

  describe("Tool Lookup", () => {
    beforeEach(() => {
      registerTool("Test Tool", "navigation", "TestCorp", "Model1", "TEST123");
    });

    it("should retrieve tool by ID", () => {
      const tool = getToolInfo(1);
      expect(tool).toBeTruthy();
      expect(tool.name).toBe("Test Tool");
    });

    it("should retrieve tool by serial number", () => {
      const tool = getToolBySerial("TEST123");
      expect(tool).toBeTruthy();
      expect(tool.name).toBe("Test Tool");
    });

    it("should return null for non-existent tool", () => {
      const tool = getToolInfo(999);
      expect(tool).toBeNull();
    });
  });

  describe("Certification Status", () => {
    beforeEach(() => {
      registerTool("Test Tool", "navigation", "TestCorp", "Model1", "TEST123");
    });

    it("should return false for uncertified tool", () => {
      const certified = isToolCertified(1);
      expect(certified).toBe(false);
    });

    it("should return true for certified tool", () => {
      certifyTool(1);
      const certified = isToolCertified(1);
      expect(certified).toBe(true);
    });

    it("should return false for non-existent tool", () => {
      const certified = isToolCertified(999);
      expect(certified).toBe(false);
    });
  });
});
