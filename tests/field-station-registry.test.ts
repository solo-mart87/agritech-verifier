import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state
const mockContract = {
  fieldStations: new Map(),
  stationCapabilities: new Map(),
  stationCapabilityCount: new Map(),
  researchProjects: new Map(),
  stationProjectCount: new Map(),
  nextStationId: 1,
  contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  currentSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 1000,
};

// Mock contract functions
function registerStation(name, location, researchType, establishedDate) {
  const stationId = mockContract.nextStationId;

  // Validate inputs
  if (!name || !location || !researchType || establishedDate <= 0) {
    return { error: "invalid-input" };
  }

  const station = {
    name,
    location,
    researchType,
    operator: mockContract.currentSender,
    verified: false,
    verificationDate: 0,
    establishedDate,
    status: "registered",
  };

  mockContract.fieldStations.set(stationId, station);
  mockContract.stationCapabilityCount.set(stationId, 0);
  mockContract.stationProjectCount.set(stationId, 0);
  mockContract.nextStationId++;

  return { success: stationId };
}

function verifyStation(stationId) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  const station = mockContract.fieldStations.get(stationId);
  if (!station) {
    return { error: "not-found" };
  }

  station.verified = true;
  station.verificationDate = mockContract.blockHeight;
  station.status = "verified";

  return { success: true };
}

function addCapability(stationId, capabilityName, description) {
  const station = mockContract.fieldStations.get(stationId);
  if (!station) {
    return { error: "not-found" };
  }

  if (mockContract.currentSender !== station.operator) {
    return { error: "unauthorized" };
  }

  const capabilityId = mockContract.stationCapabilityCount.get(stationId) || 0;
  const capabilityKey = `${stationId}-${capabilityId}`;

  mockContract.stationCapabilities.set(capabilityKey, {
    capabilityName,
    description,
    certified: false,
    certificationDate: 0,
  });

  mockContract.stationCapabilityCount.set(stationId, capabilityId + 1);

  return { success: capabilityId };
}

function certifyCapability(stationId, capabilityId) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  const capabilityKey = `${stationId}-${capabilityId}`;
  const capability = mockContract.stationCapabilities.get(capabilityKey);
  if (!capability) {
    return { error: "not-found" };
  }

  capability.certified = true;
  capability.certificationDate = mockContract.blockHeight;

  return { success: true };
}

function addResearchProject(stationId, projectName, startDate, endDate) {
  const station = mockContract.fieldStations.get(stationId);
  if (!station) {
    return { error: "not-found" };
  }

  if (mockContract.currentSender !== station.operator) {
    return { error: "unauthorized" };
  }

  if (startDate >= endDate) {
    return { error: "invalid-input" };
  }

  const projectId = mockContract.stationProjectCount.get(stationId) || 0;
  const projectKey = `${stationId}-${projectId}`;

  mockContract.researchProjects.set(projectKey, {
    projectName,
    startDate,
    endDate,
    status: "active",
    researcher: mockContract.currentSender,
  });

  mockContract.stationProjectCount.set(stationId, projectId + 1);

  return { success: projectId };
}

function getStationInfo(stationId) {
  return mockContract.fieldStations.get(stationId) || null;
}

function getCapability(stationId, capabilityId) {
  const capabilityKey = `${stationId}-${capabilityId}`;
  return mockContract.stationCapabilities.get(capabilityKey) || null;
}

function getResearchProject(stationId, projectId) {
  const projectKey = `${stationId}-${projectId}`;
  return mockContract.researchProjects.get(projectKey) || null;
}

function isStationVerified(stationId) {
  const station = mockContract.fieldStations.get(stationId);
  return station ? station.verified : false;
}

describe("Field Station Registry Contract", () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContract.fieldStations.clear();
    mockContract.stationCapabilities.clear();
    mockContract.stationCapabilityCount.clear();
    mockContract.researchProjects.clear();
    mockContract.stationProjectCount.clear();
    mockContract.nextStationId = 1;
    mockContract.currentSender = mockContract.contractOwner;
    mockContract.blockHeight = 1000;
  });

  describe("Station Registration", () => {
    it("should register new station successfully", () => {
      const result = registerStation(
        "Iowa Research Station",
        "Iowa, USA",
        "corn-soybean-research",
        1609459200 // 2021-01-01
      );

      expect(result.success).toBe(1);

      const station = getStationInfo(1);
      expect(station.name).toBe("Iowa Research Station");
      expect(station.location).toBe("Iowa, USA");
      expect(station.researchType).toBe("corn-soybean-research");
      expect(station.verified).toBe(false);
      expect(station.status).toBe("registered");
    });

    it("should validate input parameters", () => {
      // Empty name
      let result = registerStation("", "Location", "research-type", 1609459200);
      expect(result.error).toBe("invalid-input");

      // Empty location
      result = registerStation("Station", "", "research-type", 1609459200);
      expect(result.error).toBe("invalid-input");

      // Empty research type
      result = registerStation("Station", "Location", "", 1609459200);
      expect(result.error).toBe("invalid-input");

      // Invalid established date
      result = registerStation("Station", "Location", "research-type", 0);
      expect(result.error).toBe("invalid-input");
    });

    it("should increment station IDs correctly", () => {
      const result1 = registerStation(
        "Station 1",
        "Location 1",
        "type1",
        1609459200
      );
      const result2 = registerStation(
        "Station 2",
        "Location 2",
        "type2",
        1609459200
      );

      expect(result1.success).toBe(1);
      expect(result2.success).toBe(2);
    });
  });

  describe("Station Verification", () => {
    beforeEach(() => {
      registerStation(
        "Test Station",
        "Test Location",
        "test-research",
        1609459200
      );
    });

    it("should verify station by contract owner", () => {
      const result = verifyStation(1);
      expect(result.success).toBe(true);

      const station = getStationInfo(1);
      expect(station.verified).toBe(true);
      expect(station.verificationDate).toBe(mockContract.blockHeight);
      expect(station.status).toBe("verified");
    });

    it("should reject verification by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = verifyStation(1);
      expect(result.error).toBe("owner-only");
    });

    it("should reject verification of non-existent station", () => {
      const result = verifyStation(999);
      expect(result.error).toBe("not-found");
    });
  });

  describe("Station Capabilities", () => {
    beforeEach(() => {
      registerStation(
        "Test Station",
        "Test Location",
        "test-research",
        1609459200
      );
    });

    it("should add capability by station operator", () => {
      const result = addCapability(
        1,
        "soil-analysis",
        "Advanced soil composition analysis"
      );
      expect(result.success).toBe(0);

      const capability = getCapability(1, 0);
      expect(capability.capabilityName).toBe("soil-analysis");
      expect(capability.description).toBe("Advanced soil composition analysis");
      expect(capability.certified).toBe(false);
    });

    it("should reject capability addition by non-operator", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = addCapability(
        1,
        "soil-analysis",
        "Unauthorized capability"
      );
      expect(result.error).toBe("unauthorized");
    });

    it("should certify capability by contract owner", () => {
      addCapability(1, "soil-analysis", "Advanced soil composition analysis");

      const result = certifyCapability(1, 0);
      expect(result.success).toBe(true);

      const capability = getCapability(1, 0);
      expect(capability.certified).toBe(true);
      expect(capability.certificationDate).toBe(mockContract.blockHeight);
    });

    it("should track multiple capabilities", () => {
      addCapability(1, "soil-analysis", "Soil analysis capability");
      addCapability(1, "crop-monitoring", "Crop monitoring capability");

      expect(mockContract.stationCapabilityCount.get(1)).toBe(2);
    });
  });

  describe("Research Projects", () => {
    beforeEach(() => {
      registerStation(
        "Test Station",
        "Test Location",
        "test-research",
        1609459200
      );
    });

    it("should add research project by station operator", () => {
      const result = addResearchProject(
        1,
        "Corn Yield Study",
        1609459200,
        1640995200
      );
      expect(result.success).toBe(0);

      const project = getResearchProject(1, 0);
      expect(project.projectName).toBe("Corn Yield Study");
      expect(project.startDate).toBe(1609459200);
      expect(project.endDate).toBe(1640995200);
      expect(project.status).toBe("active");
    });

    it("should reject project addition by non-operator", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = addResearchProject(
        1,
        "Unauthorized Project",
        1609459200,
        1640995200
      );
      expect(result.error).toBe("unauthorized");
    });

    it("should validate project dates", () => {
      // End date before start date
      const result = addResearchProject(
        1,
        "Invalid Project",
        1640995200,
        1609459200
      );
      expect(result.error).toBe("invalid-input");

      // Same start and end date
      const result2 = addResearchProject(
        1,
        "Invalid Project 2",
        1609459200,
        1609459200
      );
      expect(result2.error).toBe("invalid-input");
    });

    it("should track multiple projects", () => {
      addResearchProject(1, "Project 1", 1609459200, 1640995200);
      addResearchProject(1, "Project 2", 1609459200, 1640995200);

      expect(mockContract.stationProjectCount.get(1)).toBe(2);
    });
  });

  describe("Station Lookup", () => {
    beforeEach(() => {
      registerStation(
        "Test Station",
        "Test Location",
        "test-research",
        1609459200
      );
    });

    it("should retrieve station information", () => {
      const station = getStationInfo(1);
      expect(station).toBeTruthy();
      expect(station.name).toBe("Test Station");
    });

    it("should return null for non-existent station", () => {
      const station = getStationInfo(999);
      expect(station).toBeNull();
    });
  });

  describe("Verification Status", () => {
    beforeEach(() => {
      registerStation(
        "Test Station",
        "Test Location",
        "test-research",
        1609459200
      );
    });

    it("should return false for unverified station", () => {
      const verified = isStationVerified(1);
      expect(verified).toBe(false);
    });

    it("should return true for verified station", () => {
      verifyStation(1);
      const verified = isStationVerified(1);
      expect(verified).toBe(true);
    });

    it("should return false for non-existent station", () => {
      const verified = isStationVerified(999);
      expect(verified).toBe(false);
    });
  });
});
