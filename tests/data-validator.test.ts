import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state
const mockContract = {
  researchData: new Map(),
  dataByHash: new Map(),
  validationMetadata: new Map(),
  peerReviews: new Map(),
  authorizedValidators: new Map(),
  nextDataId: 1,
  contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  currentSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 1000,
};

// Mock contract functions
function submitData(title: string, dataHash: string, dataType: string) {
  const dataId = mockContract.nextDataId;

  // Check if data hash already exists
  if (mockContract.dataByHash.has(dataHash)) {
    return { error: "already-exists" };
  }

  // Validate inputs
  if (!title || dataHash.length !== 64 || !dataType) {
    return { error: "invalid-input" };
  }

  const data = {
    title,
    dataHash,
    submitter: mockContract.currentSender,
    submissionDate: mockContract.blockHeight,
    dataType,
    validated: false,
    validationDate: 0,
    validator: null,
    status: "submitted",
  };

  mockContract.researchData.set(dataId, data);
  mockContract.dataByHash.set(dataHash, dataId);
  mockContract.validationMetadata.set(dataId, {
    validationMethod: "",
    confidenceScore: 0,
    notes: "",
    peerReviews: 0,
  });
  mockContract.nextDataId++;

  return { success: dataId };
}

function authorizeValidator(validator: string) {
  if (mockContract.currentSender !== mockContract.contractOwner) {
    return { error: "owner-only" };
  }

  mockContract.authorizedValidators.set(validator, {
    authorized: true,
    authorizationDate: mockContract.blockHeight,
  });

  return { success: true };
}

function validateData(
  dataId: number,
  validationMethod: string,
  confidenceScore: number,
  notes: string
) {
  const validatorAuth = mockContract.authorizedValidators.get(
    mockContract.currentSender
  );
  if (!validatorAuth || !validatorAuth.authorized) {
    return { error: "unauthorized" };
  }

  const data = mockContract.researchData.get(dataId);
  if (!data) {
    return { error: "not-found" };
  }

  if (data.validated) {
    return { error: "already-validated" };
  }

  if (confidenceScore > 100) {
    return { error: "invalid-input" };
  }

  data.validated = true;
  data.validationDate = mockContract.blockHeight;
  data.validator = mockContract.currentSender;
  data.status = "validated";

  mockContract.validationMetadata.set(dataId, {
    validationMethod,
    confidenceScore,
    notes,
    peerReviews: 0,
  });

  return { success: true };
}

function addPeerReview(
  dataId: number,
  score: number,
  comments: string,
  approved: boolean
) {
  const validatorAuth = mockContract.authorizedValidators.get(
    mockContract.currentSender
  );
  if (!validatorAuth || !validatorAuth.authorized) {
    return { error: "unauthorized" };
  }

  const data = mockContract.researchData.get(dataId);
  if (!data) {
    return { error: "not-found" };
  }

  if (score > 100) {
    return { error: "invalid-input" };
  }

  const reviewKey = `${dataId}-${mockContract.currentSender}`;
  mockContract.peerReviews.set(reviewKey, {
    reviewDate: mockContract.blockHeight,
    score,
    comments,
    approved,
  });

  const metadata = mockContract.validationMetadata.get(dataId);
  metadata.peerReviews++;

  return { success: true };
}

function getDataInfo(dataId: number) {
  return mockContract.researchData.get(dataId) || null;
}

function getDataByHash(dataHash: string) {
  const dataId = mockContract.dataByHash.get(dataHash);
  return dataId ? mockContract.researchData.get(dataId) : null;
}

function isValidatorAuthorized(validator: string) {
  const auth = mockContract.authorizedValidators.get(validator);
  return auth ? auth.authorized : false;
}

function isDataValidated(dataId: number) {
  const data = mockContract.researchData.get(dataId);
  return data ? data.validated : false;
}

function verifyDataIntegrity(dataId: number, providedHash: string) {
  const data = mockContract.researchData.get(dataId);
  return data ? data.dataHash === providedHash : false;
}

describe("Data Validator Contract", () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContract.researchData.clear();
    mockContract.dataByHash.clear();
    mockContract.validationMetadata.clear();
    mockContract.peerReviews.clear();
    mockContract.authorizedValidators.clear();
    mockContract.nextDataId = 1;
    mockContract.currentSender = mockContract.contractOwner;
    mockContract.blockHeight = 1000;
  });

  describe("Data Submission", () => {
    it("should validate input parameters", () => {
      // Empty title
      let result = submitData(
        "",
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
        "soil-analysis"
      );
      expect(result.error).toBe("invalid-input");

      // Invalid hash length
      result = submitData("Study", "short-hash", "soil-analysis");
      expect(result.error).toBe("invalid-input");

      // Empty data type
      result = submitData(
        "Study",
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
        ""
      );
      expect(result.error).toBe("invalid-input");
    });
  });

  describe("Validator Authorization", () => {
    it("should authorize validator by contract owner", () => {
      const validator: string = "ST2VALIDATOR_ADDRESS";
      const result = authorizeValidator(validator);
      expect(result.success).toBe(true);

      const authorized = isValidatorAuthorized(validator);
      expect(authorized).toBe(true);
    });

    it("should reject authorization by non-owner", () => {
      mockContract.currentSender = "ST2DIFFERENT_ADDRESS";

      const result = authorizeValidator("ST2VALIDATOR_ADDRESS");
      expect(result.error).toBe("owner-only");
    });
  });

  describe("Data Validation", () => {
    it("should reject validation by unauthorized validator", () => {
      mockContract.currentSender = "ST2UNAUTHORIZED_ADDRESS";

      const dataId: number = 1;
      const validationMethod: string = "statistical-analysis";
      const confidenceScore: number = 85;
      const notes: string = "Unauthorized validation";

      const result = validateData(
        dataId,
        validationMethod,
        confidenceScore,
        notes
      );
      expect(result.error).toBe("unauthorized");
    });
  });

  describe("Peer Reviews", () => {
    it("should reject peer review by unauthorized reviewer", () => {
      mockContract.currentSender = "ST2UNAUTHORIZED_ADDRESS";

      const dataId: number = 1;
      const score: number = 88;
      const comments: string = "Unauthorized review";
      const approved: boolean = true;

      const result = addPeerReview(dataId, score, comments, approved);
      expect(result.error).toBe("unauthorized");
    });
  });

  describe("Data Lookup", () => {
    it("should return null for non-existent data", () => {
      const data = getDataInfo(999);
      expect(data).toBeNull();
    });
  });

  describe("Data Integrity", () => {
    it("should reject incorrect data hash", () => {
      const verified = verifyDataIntegrity(
        1,
        "incorrect_hash_value_here_1234567890123456789012345678901234567890"
      );
      expect(verified).toBe(false);
    });

    it("should return false for non-existent data", () => {
      const verified = verifyDataIntegrity(
        999,
        "any_hash_value_here_1234567890123456789012345678901234567890123456"
      );
      expect(verified).toBe(false);
    });
  });
});
