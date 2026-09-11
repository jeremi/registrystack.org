---
title: 'What must a reviewer reconstruct after registry access?'
description: 'A review checklist for connecting the request, authority, policy, source consultation, disclosure, outcome, and retained audit evidence.'
publishedAt: 2026-07-30
author: 'Registry Stack'
audience: 'Security reviewers, auditors, data-protection teams, registry owners, and funders'
category: 'Review guide'
readingMinutes: 13
order: 3
featured: true
status: published
---

“Every request is logged” sounds reassuring. It is not yet a review method.

A web-server log may prove that an endpoint returned `200`. It may not explain
who the caller was, which authority allowed the request, which policy version
was applied, what source was consulted, what was disclosed, or whether a
failure was incorrectly treated as a negative answer.

For governed registry access, a reviewer should be able to follow one request
through a chain of accountable decisions:

```text
service need
    -> authenticated requester
    -> purpose and scope
    -> policy decision
    -> source consultation
    -> disclosure decision
    -> returned result or denial
    -> retained evidence and operational ownership
```

This guide defines the questions that review should answer. It is not a claim
that software can prove the legality or correctness of a public-service
decision by itself.

## Begin with the reconstruction question

A useful audit review starts with a scenario, not a log file.

For example:

> On 18 July, the voucher service asked whether applicant A had an active
> farmer registration. It received a positive predicate. Can we reconstruct
> why that request was admitted, which source consultation supported it, what
> left the registry, and which controls were in force?

That question has seven parts:

| Review area     | What the reviewer must establish                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service context | Which public service or procedure caused the request, and who owned the resulting action                                                         |
| Requester       | Which authenticated system or role asked, with which scope and access mode                                                                       |
| Authority       | Which institution owned the source and was authoritative for the requested fact                                                                  |
| Policy          | Which purpose, claim, policy version or hash, and disclosure rule were applied                                                                   |
| Source          | Which Relay consultation and source binding produced the typed facts                                                                             |
| Outcome         | Whether the request was allowed, denied, unavailable, ambiguous, or failed, and what response shape left the boundary                            |
| Continuity      | Whether the retained records form a verifiable sequence, were shipped or anchored as required, and remain within the approved retention boundary |

If one of these parts only exists in a meeting note or a person's memory, the
technical log is not the complete review record.

## Learn from integration projects, then go one step further

[OpenFn has written](https://www.openfn.org/blog/2021-07-30-processes-and-open-source-as-choice)
about implementation artifacts making parts of a data-sharing agreement
machine-readable and reviewable. That is an important shift: the agreement is
no longer only a document beside the system.

Registry Stack applies the same discipline to the access path:

- Registry Relay configuration defines how an approved source can be read and
  which typed outputs exist.
- Evidence Gateway configuration defines who can request a claim, for which
  purpose, and what disclosure modes are allowed.
- Runtime audit records show which configured path was exercised.
- The service and registry owners remain responsible for approving the
  question, the authority, and the use of the answer.

The extra step is to review those objects together. Configuration without
runtime evidence shows intention. Runtime logs without reviewed configuration
show activity. A reviewer needs both.

## The reconstruction checklist

Use the [downloadable review
checklist](/downloads/registry-access-review-checklist.md) for a pilot or
architecture review.

### 1. Establish the service and decision owner

- What legitimate service caused the request?
- Which institution owned the eligibility, approval, payment, referral, or
  other action that followed?
- Was Registry Stack returning source access, evidence, or an attestation of a
  decision already made by the source authority?
- Was the question approved for this service, or merely technically possible?

This prevents a common category error. An Evidence Gateway result can provide
evidence to a programme. It does not silently become the programme's decision.

### 2. Identify the requester without spreading more identifiers

- Which authentication mode admitted the caller?
- Which principal or workload identity was used?
- Which scopes were checked?
- Was the request subject-bound, representative, delegated, or a machine
  request?
- Can the reviewer correlate repeated activity when permitted without storing
  raw subject identifiers throughout the logs?

Evidence Gateway audit events use keyed hashes for principal and subject
references. Registry Relay has its own product-specific audit record. Reviewers
should be given an approved interpretation layer, not unrestricted access to
every raw log or secret used to derive identifiers.

### 3. Reconstruct purpose and policy

- Which declared purpose accompanied the request?
- Which claim or route was requested?
- Which policy identifier, version, or hash was in force?
- Which rule or scope produced the permit or denial?
- Did the caller request a disclosure mode, and which mode was applied?
- Was an exception, representative relationship, or credential profile
  involved?

“The caller had a token” is not enough. Authentication establishes an identity.
It does not prove that this identity could ask this question for this purpose.

### 4. Follow the source consultation

For a Relay read:

- Which dataset, entity, relationship, aggregate, or configured route was
  accessed?
- Which filters and projections were permitted?
- Which source binding and snapshot or scan mode applied?
- How many rows or groups were returned?
- What freshness statement can the operator support?

For an Evidence Gateway evaluation backed by Relay:

- Which consultation identifier did Evidence Gateway invoke?
- Did Relay return `match`, `no_match`, or `ambiguous`?
- Which typed outputs were made available to the claim?
- Did Evidence Gateway preserve source, denial, verification, and availability
  failures instead of converting them to `false`?

Evidence Gateway and Relay keep separate audit authority. Their evaluation and
consultation identifiers provide the restricted bridge for reconstruction.
Do not join the logs by raw subject identifier.

### 5. Identify exactly what left the boundary

- Did Relay return selected fields, records, a relationship, or an aggregate?
- Did Evidence Gateway return `value`, `predicate`, or `redacted`?
- Which object fields were redacted?
- Was the response a plain evaluation result, a credential, or a signed
  federation result?
- Did the caller receive any data not listed in the approved question?

A successful policy decision does not prove that the disclosure was minimal.
Review the response shape and the underlying claim or route configuration.

### 6. Preserve denials and uncertainty

The review view must not flatten these into one “failed” state:

| State                | Review meaning                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Matched false value  | The authoritative source consultation matched and the configured boolean evidence evaluated to false |
| `no_match`           | No admissible record was resolved under the reviewed matcher                                         |
| `ambiguous`          | More than one admissible result remained                                                             |
| Denied               | Authentication, scope, purpose, relationship, policy, or another gate refused the request            |
| Unavailable          | The required source or service could not provide an answer                                           |
| Verification failure | A contract, signature, token, or other verification step failed                                      |
| Stale                | The source or portable evidence was older than the consuming service accepts                         |

Only the first row is a false evidence value. The others are reasons that the
service does not have the requested evidence.

### 7. Test retention and integrity claims

Registry Stack can write keyed, chained audit envelopes. Each envelope binds
its identifier, timestamp, previous hash, event record, and record hash. With
the deployment secret protected, rewriting an interior record without
detection becomes harder.

That statement has boundaries:

- A valid local chain does not prove that the application made the correct
  policy decision.
- A chain by itself cannot prove that its tail was not deleted. Off-host
  shipping, acknowledgements, or another retained anchor are needed when tail
  removal is in the threat model.
- A file is not durable merely because it is hashed. Retention, access control,
  backup, and recovery are operator responsibilities.
- Audit fail-closed is a deployment capability. Review which protected route
  families use it and whether the running posture confirms it.
- Relay and Evidence Gateway use separate audit keys and chains. Reusing secrets or
  storage across trust domains weakens the boundary.

Ask the operator to demonstrate chain verification, off-host handling, and
recovery. Do not accept the phrase “tamper-proof log” as evidence.

## A sanitized reconstruction example

The example below is a reviewer-facing view assembled from current Relay and
Evidence Gateway concepts. It is not a raw production log and contains no personal
identifier or source value.

### Approved question

| Field                | Reviewed value                                                  |
| -------------------- | --------------------------------------------------------------- |
| Service              | Seasonal input voucher application                              |
| Decision owner       | Agricultural support programme                                  |
| Registry authority   | Farmer registry                                                 |
| Requester            | Registered voucher-service workload                             |
| Purpose              | Confirm current farmer registration for this application        |
| Claim                | `farmer.registration.active`                                    |
| Permitted disclosure | `predicate`                                                     |
| Must not disclose    | Source row, name, contact details, land parcels, household data |

### Evidence Gateway review view

| Current audit concept          | Sanitized observation                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `event_id` and `occurred_at`   | One bounded event and UTC time are present                                                         |
| `principal_id_hash`            | A keyed pseudonym identifies the admitted workload without storing its raw identifier in this view |
| `scopes_used`                  | The configured claim-read scope was exercised                                                      |
| `purposes`                     | The approved voucher-review purpose was recorded                                                   |
| `claim_hash` and `policy_hash` | The evaluated claim and policy configuration are bound without copying their sensitive content     |
| `decision` and `status`        | Evaluation allowed and returned success                                                            |
| `relay_consultation_count`     | One Relay consultation supported the evaluation                                                    |
| `relay_consultation_ids`       | The restricted correlation identifier is available to the reviewer                                 |
| `redacted_fields`              | No unexpected value fields were released                                                           |

### Relay review view

| Current audit concept                        | Sanitized observation                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `request_id`                                 | The consultation request has a server-owned correlation identifier                             |
| `principal_id` and `auth_mode`               | The configured Evidence Gateway workload was authenticated through the approved mode           |
| `dataset_id` and route context               | The farmer-registration dataset and declared consultation path were used                       |
| `scopes_used` and `purpose`                  | The expected dataset scope and purpose were checked                                            |
| Policy identifiers and hashes                | The governed access policy and evaluated rules can be identified where the PDP profile is used |
| `status_code`, `row_count`, and `error_code` | The request outcome is distinguishable from a denial or source error                           |
| Envelope hashes                              | The event is retained in the Relay audit chain                                                 |

### Result and decision

The Evidence Gateway response disclosed a predicate. The reviewer can establish that the
source row was not returned through that response.

The agricultural support programme then made its own voucher decision. That
decision belongs in the programme's case record. Registry Stack audit evidence
does not replace it.

This separation is intentional:

```text
Registry Stack evidence:
  who asked + under which policy + which source consultation + what was returned

Programme decision record:
  how the evidence and other case facts produced an approval, denial, or action
```

## What the evidence cannot prove by itself

A careful review ends with non-guarantees:

- **Source truth:** Relay reports what the configured source consultation
  produced. It does not prove that the source record is factually correct or
  current.
- **Legal authority:** Configuration can encode reviewed rules. It cannot
  establish the legal basis or institutional mandate that justified them.
- **Consumer behaviour:** A minimized response does not prove that the
  consuming service used it properly or deleted its own retained data.
- **Complete history:** A local chain needs protected keys, retention, and
  appropriate off-host evidence to support stronger continuity claims.
- **Secure operation:** Key custody, transport security, rate limiting,
  monitoring, backup, tenant separation, and incident response remain
  deployment responsibilities.
- **General standards conformance:** A standards-shaped response or configured
  protocol profile is not certification by an external standards body.

These limits do not make audit evidence unhelpful. They prevent the evidence
from being asked to prove more than it contains.

## The minimum review packet

For a pilot, request these eight items:

1. The approved registry-question worksheet.
2. The source authority and consuming-service decision owner.
3. The compiled route, consultation, claim, and disclosure configuration
   relevant to the scenario.
4. One allowed request and one denial.
5. One `no_match`, ambiguity, or source-failure path where the scenario permits
   safe testing.
6. The corresponding Relay and Evidence Gateway audit records, sanitized through the
   approved review process.
7. Evidence that the retained chains verify and that the deployment's shipping
   or anchoring posture matches its claim.
8. The consumer's own decision record showing how the evidence was used.

If a project cannot assemble this packet with synthetic data, it is not ready
to claim reviewable operation with real registry records.

For the implementation details, read the [Registry Stack security
model](https://docs.registrystack.org/spec/rs-sec-g/), [evidence issuance
explanation](https://docs.registrystack.org/explanation/evidence-issuance/),
and [known limitations
inventory](https://docs.registrystack.org/explanation/known-limitations/).
