;; Precision Tools Smart Contract
;; Manages precision farming tool certification and performance tracking

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u400))
(define-constant err-not-found (err u401))
(define-constant err-already-exists (err u402))
(define-constant err-invalid-input (err u403))
(define-constant err-unauthorized (err u404))

;; Data Variables
(define-data-var next-tool-id uint u1)

;; Data Maps
(define-map precision-tools
  { tool-id: uint }
  {
    name: (string-ascii 100),
    tool-type: (string-ascii 50),
    manufacturer: (string-ascii 50),
    model: (string-ascii 50),
    serial-number: (string-ascii 50),
    owner: principal,
    certified: bool,
    certification-date: uint,
    last-calibration: uint,
    status: (string-ascii 20)
  }
)

(define-map tool-by-serial
  { serial-number: (string-ascii 50) }
  { tool-id: uint }
)

(define-map calibration-records
  { tool-id: uint, calibration-id: uint }
  {
    calibration-date: uint,
    calibrator: principal,
    accuracy-score: uint,
    notes: (string-ascii 200),
    passed: bool
  }
)

(define-map tool-calibration-count
  { tool-id: uint }
  { count: uint }
)

(define-map performance-metrics
  { tool-id: uint, metric-id: uint }
  {
    metric-date: uint,
    metric-type: (string-ascii 50),
    value: uint,
    unit: (string-ascii 20),
    recorded-by: principal
  }
)

(define-map tool-metric-count
  { tool-id: uint }
  { count: uint }
)

(define-map authorized-calibrators
  { calibrator: principal }
  { authorized: bool, authorization-date: uint }
)

;; Public Functions

;; Register precision tool
(define-public (register-tool
  (name (string-ascii 100))
  (tool-type (string-ascii 50))
  (manufacturer (string-ascii 50))
  (model (string-ascii 50))
  (serial-number (string-ascii 50)))
  (let
    (
      (tool-id (var-get next-tool-id))
    )
    ;; Check if serial number already exists
    (asserts! (is-none (map-get? tool-by-serial { serial-number: serial-number })) err-already-exists)
    
    ;; Validate inputs
    (asserts! (> (len name) u0) err-invalid-input)
    (asserts! (> (len tool-type) u0) err-invalid-input)
    (asserts! (> (len manufacturer) u0) err-invalid-input)
    (asserts! (> (len model) u0) err-invalid-input)
    (asserts! (> (len serial-number) u0) err-invalid-input)
    
    ;; Register tool
    (map-set precision-tools
      { tool-id: tool-id }
      {
        name: name,
        tool-type: tool-type,
        manufacturer: manufacturer,
        model: model,
        serial-number: serial-number,
        owner: tx-sender,
        certified: false,
        certification-date: u0,
        last-calibration: u0,
        status: "registered"
      }
    )
    
    ;; Map serial number to tool ID
    (map-set tool-by-serial
      { serial-number: serial-number }
      { tool-id: tool-id }
    )
    
    ;; Initialize counts
    (map-set tool-calibration-count
      { tool-id: tool-id }
      { count: u0 }
    )
    
    (map-set tool-metric-count
      { tool-id: tool-id }
      { count: u0 }
    )
    
    ;; Increment next tool ID
    (var-set next-tool-id (+ tool-id u1))
    
    (ok tool-id)
  )
)

;; Authorize calibrator (only contract owner)
(define-public (authorize-calibrator (calibrator principal))
  (begin
    ;; Only contract owner can authorize calibrators
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Authorize calibrator
    (map-set authorized-calibrators
      { calibrator: calibrator }
      { authorized: true, authorization-date: stacks-block-height }
    )
    
    (ok true)
  )
)

;; Calibrate tool (only authorized calibrators)
(define-public (calibrate-tool
  (tool-id uint)
  (accuracy-score uint)
  (notes (string-ascii 200))
  (passed bool))
  (let
    (
      (tool (unwrap! (map-get? precision-tools { tool-id: tool-id }) err-not-found))
      (calibration-count-data (default-to { count: u0 } (map-get? tool-calibration-count { tool-id: tool-id })))
      (calibration-id (get count calibration-count-data))
      (calibrator-auth (default-to { authorized: false, authorization-date: u0 } 
                       (map-get? authorized-calibrators { calibrator: tx-sender })))
    )
    ;; Check if calibrator is authorized
    (asserts! (get authorized calibrator-auth) err-unauthorized)
    
    ;; Validate accuracy score (0-100)
    (asserts! (<= accuracy-score u100) err-invalid-input)
    
    ;; Add calibration record
    (map-set calibration-records
      { tool-id: tool-id, calibration-id: calibration-id }
      {
        calibration-date: stacks-block-height,
        calibrator: tx-sender,
        accuracy-score: accuracy-score,
        notes: notes,
        passed: passed
      }
    )
    
    ;; Update calibration count
    (map-set tool-calibration-count
      { tool-id: tool-id }
      { count: (+ calibration-id u1) }
    )
    
    ;; Update tool last calibration and status
    (map-set precision-tools
      { tool-id: tool-id }
      (merge tool {
        last-calibration: stacks-block-height,
        status: (if passed "calibrated" "needs-calibration")
      })
    )
    
    (ok calibration-id)
  )
)

;; Certify tool (only contract owner)
(define-public (certify-tool (tool-id uint))
  (let
    (
      (tool (unwrap! (map-get? precision-tools { tool-id: tool-id }) err-not-found))
    )
    ;; Only contract owner can certify
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Update tool certification
    (map-set precision-tools
      { tool-id: tool-id }
      (merge tool {
        certified: true,
        certification-date: stacks-block-height,
        status: "certified"
      })
    )
    
    (ok true)
  )
)

;; Record performance metric
(define-public (record-performance-metric
  (tool-id uint)
  (metric-type (string-ascii 50))
  (value uint)
  (unit (string-ascii 20)))
  (let
    (
      (tool (unwrap! (map-get? precision-tools { tool-id: tool-id }) err-not-found))
      (metric-count-data (default-to { count: u0 } (map-get? tool-metric-count { tool-id: tool-id })))
      (metric-id (get count metric-count-data))
    )
    ;; Only tool owner can record metrics
    (asserts! (is-eq tx-sender (get owner tool)) err-unauthorized)
    
    ;; Validate inputs
    (asserts! (> (len metric-type) u0) err-invalid-input)
    (asserts! (> (len unit) u0) err-invalid-input)
    
    ;; Record metric
    (map-set performance-metrics
      { tool-id: tool-id, metric-id: metric-id }
      {
        metric-date: stacks-block-height,
        metric-type: metric-type,
        value: value,
        unit: unit,
        recorded-by: tx-sender
      }
    )
    
    ;; Update metric count
    (map-set tool-metric-count
      { tool-id: tool-id }
      { count: (+ metric-id u1) }
    )
    
    (ok metric-id)
  )
)

;; Transfer tool ownership
(define-public (transfer-tool (tool-id uint) (new-owner principal))
  (let
    (
      (tool (unwrap! (map-get? precision-tools { tool-id: tool-id }) err-not-found))
    )
    ;; Only current owner can transfer
    (asserts! (is-eq tx-sender (get owner tool)) err-unauthorized)
    
    ;; Update owner
    (map-set precision-tools
      { tool-id: tool-id }
      (merge tool { owner: new-owner })
    )
    
    (ok true)
  )
)

;; Read-only Functions

;; Get tool information
(define-read-only (get-tool-info (tool-id uint))
  (map-get? precision-tools { tool-id: tool-id })
)

;; Get tool by serial number
(define-read-only (get-tool-by-serial (serial-number (string-ascii 50)))
  (match (map-get? tool-by-serial { serial-number: serial-number })
    tool-data (map-get? precision-tools { tool-id: (get tool-id tool-data) })
    none
  )
)

;; Get calibration record
(define-read-only (get-calibration-record (tool-id uint) (calibration-id uint))
  (map-get? calibration-records { tool-id: tool-id, calibration-id: calibration-id })
)

;; Get calibration count
(define-read-only (get-calibration-count (tool-id uint))
  (default-to { count: u0 } (map-get? tool-calibration-count { tool-id: tool-id }))
)

;; Get performance metric
(define-read-only (get-performance-metric (tool-id uint) (metric-id uint))
  (map-get? performance-metrics { tool-id: tool-id, metric-id: metric-id })
)

;; Get metric count
(define-read-only (get-metric-count (tool-id uint))
  (default-to { count: u0 } (map-get? tool-metric-count { tool-id: tool-id }))
)

;; Check if calibrator is authorized
(define-read-only (is-calibrator-authorized (calibrator principal))
  (match (map-get? authorized-calibrators { calibrator: calibrator })
    auth-data (get authorized auth-data)
    false
  )
)

;; Check if tool is certified
(define-read-only (is-tool-certified (tool-id uint))
  (match (map-get? precision-tools { tool-id: tool-id })
    tool (get certified tool)
    false
  )
)

;; Get next tool ID
(define-read-only (get-next-tool-id)
  (var-get next-tool-id)
)