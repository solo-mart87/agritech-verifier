;; Data Validator Smart Contract
;; Validates agricultural research data integrity and maintains immutable records

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u300))
(define-constant err-not-found (err u301))
(define-constant err-already-exists (err u302))
(define-constant err-invalid-input (err u303))
(define-constant err-unauthorized (err u304))
(define-constant err-already-validated (err u305))

;; Data Variables
(define-data-var next-data-id uint u1)

;; Data Maps
(define-map research-data
  { data-id: uint }
  {
    title: (string-ascii 100),
    data-hash: (string-ascii 64),
    submitter: principal,
    submission-date: uint,
    data-type: (string-ascii 50),
    validated: bool,
    validation-date: uint,
    validator: (optional principal),
    status: (string-ascii 20)
  }
)

(define-map data-by-hash
  { data-hash: (string-ascii 64) }
  { data-id: uint }
)

(define-map validation-metadata
  { data-id: uint }
  {
    validation-method: (string-ascii 50),
    confidence-score: uint,
    notes: (string-ascii 200),
    peer-reviews: uint
  }
)

(define-map peer-reviews
  { data-id: uint, reviewer: principal }
  {
    review-date: uint,
    score: uint,
    comments: (string-ascii 200),
    approved: bool
  }
)

(define-map authorized-validators
  { validator: principal }
  { authorized: bool, authorization-date: uint }
)

;; Public Functions

;; Submit research data
(define-public (submit-data
  (title (string-ascii 100))
  (data-hash (string-ascii 64))
  (data-type (string-ascii 50)))
  (let
    (
      (data-id (var-get next-data-id))
    )
    ;; Check if data hash already exists
    (asserts! (is-none (map-get? data-by-hash { data-hash: data-hash })) err-already-exists)
    
    ;; Validate inputs
    (asserts! (> (len title) u0) err-invalid-input)
    (asserts! (is-eq (len data-hash) u64) err-invalid-input)
    (asserts! (> (len data-type) u0) err-invalid-input)
    
    ;; Submit data
    (map-set research-data
      { data-id: data-id }
      {
        title: title,
        data-hash: data-hash,
        submitter: tx-sender,
        submission-date: stacks-block-height,
        data-type: data-type,
        validated: false,
        validation-date: u0,
        validator: none,
        status: "submitted"
      }
    )
    
    ;; Map hash to data ID
    (map-set data-by-hash
      { data-hash: data-hash }
      { data-id: data-id }
    )
    
    ;; Initialize validation metadata
    (map-set validation-metadata
      { data-id: data-id }
      {
        validation-method: "",
        confidence-score: u0,
        notes: "",
        peer-reviews: u0
      }
    )
    
    ;; Increment next data ID
    (var-set next-data-id (+ data-id u1))
    
    (ok data-id)
  )
)

;; Authorize validator (only contract owner)
(define-public (authorize-validator (validator principal))
  (begin
    ;; Only contract owner can authorize validators
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Authorize validator
    (map-set authorized-validators
      { validator: validator }
      { authorized: true, authorization-date: stacks-block-height }
    )
    
    (ok true)
  )
)

;; Validate data (only authorized validators)
(define-public (validate-data
  (data-id uint)
  (validation-method (string-ascii 50))
  (confidence-score uint)
  (notes (string-ascii 200)))
  (let
    (
      (data (unwrap! (map-get? research-data { data-id: data-id }) err-not-found))
      (validator-auth (default-to { authorized: false, authorization-date: u0 } 
                      (map-get? authorized-validators { validator: tx-sender })))
    )
    ;; Check if validator is authorized
    (asserts! (get authorized validator-auth) err-unauthorized)
    
    ;; Check if data is not already validated
    (asserts! (not (get validated data)) err-already-validated)
    
    ;; Validate confidence score (0-100)
    (asserts! (<= confidence-score u100) err-invalid-input)
    
    ;; Update data validation
    (map-set research-data
      { data-id: data-id }
      (merge data {
        validated: true,
        validation-date: stacks-block-height,
        validator: (some tx-sender),
        status: "validated"
      })
    )
    
    ;; Update validation metadata
    (map-set validation-metadata
      { data-id: data-id }
      {
        validation-method: validation-method,
        confidence-score: confidence-score,
        notes: notes,
        peer-reviews: u0
      }
    )
    
    (ok true)
  )
)

;; Add peer review
(define-public (add-peer-review
  (data-id uint)
  (score uint)
  (comments (string-ascii 200))
  (approved bool))
  (let
    (
      (data (unwrap! (map-get? research-data { data-id: data-id }) err-not-found))
      (metadata (unwrap! (map-get? validation-metadata { data-id: data-id }) err-not-found))
      (validator-auth (default-to { authorized: false, authorization-date: u0 } 
                      (map-get? authorized-validators { validator: tx-sender })))
    )
    ;; Check if reviewer is authorized
    (asserts! (get authorized validator-auth) err-unauthorized)
    
    ;; Validate score (0-100)
    (asserts! (<= score u100) err-invalid-input)
    
    ;; Add peer review
    (map-set peer-reviews
      { data-id: data-id, reviewer: tx-sender }
      {
        review-date: stacks-block-height,
        score: score,
        comments: comments,
        approved: approved
      }
    )
    
    ;; Update peer review count
    (map-set validation-metadata
      { data-id: data-id }
      (merge metadata { peer-reviews: (+ (get peer-reviews metadata) u1) })
    )
    
    (ok true)
  )
)

;; Revoke validator authorization (only contract owner)
(define-public (revoke-validator (validator principal))
  (begin
    ;; Only contract owner can revoke authorization
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Revoke authorization
    (map-set authorized-validators
      { validator: validator }
      { authorized: false, authorization-date: u0 }
    )
    
    (ok true)
  )
)

;; Read-only Functions

;; Get data information
(define-read-only (get-data-info (data-id uint))
  (map-get? research-data { data-id: data-id })
)

;; Get data by hash
(define-read-only (get-data-by-hash (data-hash (string-ascii 64)))
  (match (map-get? data-by-hash { data-hash: data-hash })
    data-info (map-get? research-data { data-id: (get data-id data-info) })
    none
  )
)

;; Get validation metadata
(define-read-only (get-validation-metadata (data-id uint))
  (map-get? validation-metadata { data-id: data-id })
)

;; Get peer review
(define-read-only (get-peer-review (data-id uint) (reviewer principal))
  (map-get? peer-reviews { data-id: data-id, reviewer: reviewer })
)

;; Check if validator is authorized
(define-read-only (is-validator-authorized (validator principal))
  (match (map-get? authorized-validators { validator: validator })
    auth-data (get authorized auth-data)
    false
  )
)

;; Check if data is validated
(define-read-only (is-data-validated (data-id uint))
  (match (map-get? research-data { data-id: data-id })
    data (get validated data)
    false
  )
)

;; Verify data integrity
(define-read-only (verify-data-integrity (data-id uint) (provided-hash (string-ascii 64)))
  (match (map-get? research-data { data-id: data-id })
    data (is-eq (get data-hash data) provided-hash)
    false
  )
)

;; Get next data ID
(define-read-only (get-next-data-id)
  (var-get next-data-id)
)