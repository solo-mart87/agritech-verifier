import { describe, it, expect, beforeEach } from "vitest";

// Mock Clarity contract functions
const mockContract = {
  equipmentRegistry: new Map(),
  equipmentBySerial: new Map(),
  maintenanceRecords: new Map(),
  equipmentMaintenanceCount: new Map(),
  nextEquipmentId: 1,
  contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  currentSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 1000,
};

// Mock contract functions
function registerEquipment(
  name,
  equipmentType,
  manufacturerYear,
  serialNumber
) {
  const equipmentId = mockContract.nextEquipmentId;

  // Check if serial number already exists
  if (mockContract.equipmentBySerial.has(serialNumber)) {
    return { error: "already-exists" };
  }

  // Validate inputs
  if (!name || !equipmentType || manufacturerYear <= 1900 || !serialNumber) {
    return { error: "invalid-input" };
  }

  // Register equipment
  const equipment = {
    name,
    equipmentType,
    manufacturerYear,
    serialNumber,
    owner: mockContract.currentSender,
    certified: false,
    certificationDate: 0,
    lastMaintenance: 0,
    status: "registered",
  };

  mockContract.equipmentRegistry.set(equipmentId, equipment);
  mockContract.equipmentBySerial.set(serialNumber, equipmentId);
  mockContract.equipmentMaintenanceCount.set(equipmentId, 0);
  mockContract.nextEquipmentId++;

  return { success: equipmentId };
}

function certifyEquipment(equipmentId) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  const equipment = mockContract.equipmentRegistry.get(equipmentId);
  if (!equipment) {
    return { error: "not-found" };
  }

  equipment.certified = true;
  equipment.certificationDate = mockContract.blockHeight;
  equipment.status = "certified";

  return { success: true };
}

function addMaintenanceRecord(equipmentId, maintenanceType, notes) {
  const equipment = mockContract.equipmentRegistry.get(equipmentId);
  if (!equipment) {
    return { error: "not-found" };
  }

  if (mockContract.currentSender !== equipment.owner) {
    return { error: "unauthorized" };
  }

  const recordId = mockContract.equipmentMaintenanceCount.get(equipmentId) || 0;
  const recordKey = `${equipmentId}-${recordId}`;

  mockContract.maintenanceRecords.set(recordKey, {
    maintenanceDate: mockContract.blockHeight,
    maintenanceType,
    technician: mockContract.currentSender,
    notes,
  });

  mockContract.equipmentMaintenanceCount.set(equipmentId, recordId + 1);
  equipment.lastMaintenance = mockContract.blockHeight;

  return { success: recordId };
}

function getEquipmentInfo(equipmentId) {
  return mockContract.equipmentRegistry.get(equipmentId) || null;
}

function getEquipmentBySerial(serialNumber) {
  const equipmentId = mockContract.equipmentBySerial.get(serialNumber);
  return equipmentId ? mockContract.equipmentRegistry.get(equipmentId) : null;
}

function isEquipmentCertified(equipmentId) {
  const equipment = mockContract.equipmentRegistry.get(equipmentId);
  return equipment ? equipment.certified : false;
}

describe("Equipment Registry Contract", () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContract.equipmentRegistry.clear();
    mockContract.equipmentBySerial.clear();
    mockContract.maintenanceRecords.clear();
    mockContract.equipmentMaintenanceCount.clear();
    mockContract.nextEquipmentId = 1;
    mockContract.currentSender = mockContract.contractOwner;
    mockContract.blockHeight = 1000;
  });

  describe("Equipment Registration", () => {
    it("should register new equipment successfully", () => {
      const result = registerEquipment(
        "John Deere X9 1100",
        "combine-harvester",
        2023,
        "JD123456789"
      );

      expect(result.success).toBe(1);

      const equipment = getEquipmentInfo(1);
      expect(equipment.name).toBe("John Deere X9 1100");
      expect(equipment.equipmentType).toBe("combine-harvester");
      expect(equipment.manufacturerYear).toBe(2023);
      expect(equipment.serialNumber).toBe("JD123456789");
      expect(equipment.certified).toBe(false);
      expect(equipment.status).toBe("registered");
    });

    it("should reject duplicate serial numbers", () => {
      registerEquipment("Equipment 1", "tractor", 2023, "SERIAL123");

      const result = registerEquipment(
        "Equipment 2",
        "harvester",
        2024,
        "SERIAL123"
      );
      expect(result.error).toBe("already-exists");
    });

    it("should validate input parameters", () => {
      // Empty name
      let result = registerEquipment("", "tractor", 2023, "SERIAL123");
      expect(result.error).toBe("invalid-input");

      // Empty equipment type
      result = registerEquipment("Tractor", "", 2023, "SERIAL123");
      expect(result.error).toBe("invalid-input");

      // Invalid year
      result = registerEquipment("Tractor", "tractor", 1800, "SERIAL123");
      expect(result.error).toBe("invalid-input");

      // Empty serial number
      result = registerEquipment("Tractor", "tractor", 2023, "");
      expect(result.error).toBe("invalid-input");
    });

    it("should increment equipment IDs correctly", () => {
      const result1 = registerEquipment(
        "Equipment 1",
        "tractor",
        2023,
        "SERIAL1"
      );
      const result2 = registerEquipment(
        "Equipment 2",
        "harvester",
        2024,
        "SERIAL2"
      );

      expect(result1.success).toBe(1);
      expect(result2.success).toBe(2);
    });
  });

  describe("Equipment Certification", () => {
    beforeEach(() => {
      registerEquipment("Test Equipment", "tractor", 2023, "TEST123");
    });

    it("should certify equipment by contract owner", () => {
      const result = certifyEquipment(1);
      expect(result.success).toBe(true);

      const equipment = getEquipmentInfo(1);
      expect(equipment.certified).toBe(true);
      expect(equipment.certificationDate).toBe(mockContract.blockHeight);
      expect(equipment.status).toBe("certified");
    });

    it("should reject certification by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = certifyEquipment(1);
      expect(result.error).toBe("owner-only");
    });

    it("should reject certification of non-existent equipment", () => {
      const result = certifyEquipment(999);
      expect(result.error).toBe("not-found");
    });
  });

  describe("Maintenance Records", () => {
    beforeEach(() => {
      registerEquipment("Test Equipment", "tractor", 2023, "TEST123");
    });

    it("should add maintenance record by equipment owner", () => {
      const result = addMaintenanceRecord(
        1,
        "routine-service",
        "Oil change and filter replacement"
      );
      expect(result.success).toBe(0);

      const equipment = getEquipmentInfo(1);
      expect(equipment.lastMaintenance).toBe(mockContract.blockHeight);
    });

    it("should reject maintenance record by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = addMaintenanceRecord(
        1,
        "routine-service",
        "Unauthorized maintenance"
      );
      expect(result.error).toBe("unauthorized");
    });

    it("should reject maintenance record for non-existent equipment", () => {
      const result = addMaintenanceRecord(
        999,
        "routine-service",
        "Non-existent equipment"
      );
      expect(result.error).toBe("not-found");
    });

    it("should track multiple maintenance records", () => {
      addMaintenanceRecord(1, "routine-service", "First maintenance");
      addMaintenanceRecord(1, "repair", "Second maintenance");

      expect(mockContract.equipmentMaintenanceCount.get(1)).toBe(2);
    });
  });

  describe("Equipment Lookup", () => {
    beforeEach(() => {
      registerEquipment("Test Equipment", "tractor", 2023, "TEST123");
    });

    it("should retrieve equipment by ID", () => {
      const equipment = getEquipmentInfo(1);
      expect(equipment).toBeTruthy();
      expect(equipment.name).toBe("Test Equipment");
    });

    it("should retrieve equipment by serial number", () => {
      const equipment = getEquipmentBySerial("TEST123");
      expect(equipment).toBeTruthy();
      expect(equipment.name).toBe("Test Equipment");
    });

    it("should return null for non-existent equipment", () => {
      const equipment = getEquipmentInfo(999);
      expect(equipment).toBeNull();
    });

    it("should return null for non-existent serial number", () => {
      const equipment = getEquipmentBySerial("NONEXISTENT");
      expect(equipment).toBeNull();
    });
  });

  describe("Certification Status", () => {
    beforeEach(() => {
      registerEquipment("Test Equipment", "tractor", 2023, "TEST123");
    });

    it("should return false for uncertified equipment", () => {
      const certified = isEquipmentCertified(1);
      expect(certified).toBe(false);
    });

    it("should return true for certified equipment", () => {
      certifyEquipment(1);
      const certified = isEquipmentCertified(1);
      expect(certified).toBe(true);
    });

    it("should return false for non-existent equipment", () => {
      const certified = isEquipmentCertified(999);
      expect(certified).toBe(false);
    });
  });
});
