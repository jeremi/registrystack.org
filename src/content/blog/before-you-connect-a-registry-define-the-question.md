---
title: 'Before you connect a registry, define the question'
description: 'A practical worksheet for agreeing who may ask, for which service, what the registry may answer, and what must remain undisclosed.'
publishedAt: 2026-07-30
author: 'Registry Stack'
audience: 'Program owners, registry owners, policy teams, and integrators'
category: 'Field guide'
readingMinutes: 12
order: 1
featured: true
status: published
---

A service team asks a civil registry for access. The first response is often a
list of fields: name, date of birth, address, family status, and perhaps a copy
of the full record.

That list may be easy to turn into an API specification. It is not yet a clear
service requirement.

The useful starting point is smaller:

> What exact question must this service answer, who is allowed to ask it, and
> what is the least revealing response that still lets the service proceed?

Writing that down before integration begins changes the conversation. The
registry owner can review a bounded request instead of a general demand for
access. The service owner must explain how the answer will be used. The
integrator receives a testable contract instead of an ambiguous data-sharing
instruction.

This guide provides a worksheet for doing that work.

## Begin with the service decision, not the source table

A registry field is not a service need.

`date_of_birth` tells an integrator where a value might be found. It does not
say why another institution needs it, whether the exact date must be disclosed,
or what should happen when the record is missing or ambiguous.

Compare three ways to describe the same request:

| Starting point | Request                                                                                                 | What remains unclear                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Source-first   | Give the benefits system access to `date_of_birth`                                                      | Purpose, permitted users, necessary precision, failure handling, and retention                      |
| API-first      | Add `GET /people/{id}` with date of birth in the response                                               | The route is clearer, but the service still receives more information than its decision may require |
| Question-first | For an authenticated school-enrolment service, confirm whether the person is within the policy age band | The purpose, requester, answer, and disclosure boundary can now be reviewed together                |

Question-first design does not remove legal, policy, or operational work. It
makes that work concrete enough to inspect.

It also prevents a technical shortcut from silently becoming policy. If the
consumer only needs an age band, returning the exact date of birth because it
already exists in a table is not neutral. It is a disclosure decision.

## What we learned from adjacent public infrastructure

Registry Stack is not the first project to discover that the work begins before
the interface.

The [GovStack architecture
playbook](https://specs.govstack.global/implementation-playbook/development/implementation/design-architecture/1-analyze-requirements)
asks teams to walk through the service, its data flows, decisions, handovers,
systems, and unresolved assumptions before selecting architecture.

OpenFn describes a similar lesson from government integrations: a
nontechnical checklist can bring the relevant institutions together and make
the rules of an integration explicit before code is written. In its Cambodia
case, the configured workflow became a machine-readable expression of parts of
the data-sharing agreement. Read the [OpenFn implementation
reflection](https://www.openfn.org/blog/2021-07-30-processes-and-open-source-as-choice).

Registry Stack narrows those ideas to one recurring boundary: a service asking
an authoritative registry for a read or an evidence answer. The worksheet below
is intentionally small enough to use in a first scoping meeting.

## The registry-question worksheet

Complete one worksheet for each distinct service question. Do not combine
several questions into “access to the registry.”

| Decision to record   | Question to answer                                                                 | Why it matters                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Service              | Which public service or administrative procedure is being delivered?               | A valid requester does not automatically have a valid purpose for every service                                    |
| Decision owner       | Which institution owns the service decision or action?                             | Registry Stack returns access or evidence; it does not take over eligibility, payment, referral, or case decisions |
| Requester            | Which system or role will make the request?                                        | Authentication identifies the caller; authorization still needs an explicit scope                                  |
| Purpose              | Why is this requester asking now?                                                  | Purpose must be reviewable and, where configured, checked on the request path                                      |
| Authority            | Which institution owns the source and can attest the requested fact?               | The consuming service cannot make another institution authoritative by calling its API                             |
| Target               | Who or what is the question about, and which identifier is permitted for matching? | Matching rules, ambiguity, and identifier exposure are part of the design                                          |
| Question             | What single fact, status, value, or protected read is required?                    | A narrow question can be reviewed, reused, and tested                                                              |
| Permitted answer     | What may leave the registry boundary?                                              | The answer may be selected fields, an aggregate, a boolean predicate, a bounded value, or an issued credential     |
| Excluded information | Which fields and inferences must not leave?                                        | Minimization becomes an explicit acceptance criterion                                                              |
| Freshness            | How current must the source and answer be?                                         | A live table scan, a local snapshot, and a portable credential have different freshness properties                 |
| Failure states       | How will no match, ambiguity, denial, source failure, and stale data differ?       | Missing evidence must not silently become a negative fact                                                          |
| Review owner         | Who approves the question, policy, source mapping, and later changes?              | Code review alone is not institutional approval                                                                    |
| Audit question       | What must a reviewer be able to reconstruct afterwards?                            | Logging volume is less important than preserving the decision context                                              |

Download the [copyable registry-question
worksheet](/downloads/registry-question-worksheet.yaml) or copy the compact
version below:

```yaml
service:
decision_owner:
requester:
purpose:
registry_authority:
target_and_permitted_identifier:
question:
permitted_answer:
must_not_disclose:
freshness_requirement:
failure_states:
policy_and_review_owner:
reviewer_must_reconstruct:
```

The completed worksheet is not a Registry Stack configuration file. It is the
review record from which configuration, tests, and operating procedures can be
derived.

## A worked example: confirm active registration

Suppose an agricultural voucher service needs to confirm that an applicant is
currently recorded in the farmer registry.

A field request might ask for the farmer's full registry row. The question
worksheet produces a smaller and more testable contract:

| Worksheet field           | Worked answer                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Service                   | Seasonal input voucher application                                                                                                    |
| Decision owner            | Agricultural support programme                                                                                                        |
| Requester                 | Voucher case-management service, using its registered workload identity                                                               |
| Purpose                   | Confirm current farmer registration for this application                                                                              |
| Authority                 | Farmer registry authority                                                                                                             |
| Target                    | Applicant identified through the approved farmer identifier                                                                           |
| Question                  | Does the authoritative source contain one admissible active registration for this applicant?                                          |
| Permitted answer          | A predicate result and its evaluation provenance                                                                                      |
| Must not disclose         | Name, address, phone number, land parcels, household members, and the source row                                                      |
| Freshness                 | Source consultation performed during the application review; any snapshot age recorded and accepted by the programme                  |
| Failure states            | `true`, `false` only for an admissible matched record with a false active status, `no_match`, `ambiguous`, `denied`, or `unavailable` |
| Review owner              | Farmer registry data steward and voucher programme owner                                                                              |
| Reviewer must reconstruct | Requester, purpose, claim and policy version, source consultation, disclosure mode, decision, and failure code                        |

The evidence is one input to the voucher programme. The programme remains
responsible for eligibility rules, prioritisation, budget, approval, and
payment. A positive registry answer is not, by itself, a voucher decision.

The distinction around failure states is equally important. `no_match` does not
prove that a person is not a farmer. The identifier may be wrong, the source may
be incomplete, or the permitted matcher may not resolve the record. `ambiguous`
means the source mapping found more than one admissible candidate. A source
failure says nothing about the person's status.

## Turn the worksheet into a product boundary

The required response determines which Registry Stack components belong in the
path.

| Need identified by the worksheet                                   | Registry Stack role                                                                                                                                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish a protected, read-only view of selected entities or fields | Registry Relay exposes declared routes over an existing source, checks the caller's dataset scope, limits filters and projections, and records the request                        |
| Return a configured aggregate                                      | Registry Relay serves the declared aggregate route; the deployment still needs to consider repeated-query disclosure because Relay does not provide a longitudinal privacy budget |
| Return a boolean or bounded value instead of a record              | Evidence Gateway evaluates the configured evidence claim against a compiler-pinned Relay consultation and applies the claim's disclosure policy                                   |
| Issue a portable credential from registry-backed evidence          | Evidence Gateway can issue the configured SD-JWT VC profile and deliver it to a wallet through a separate OID4VCI service; external wallet and verifier compatibility must be tested for the intended pilot |
| Describe datasets, policies, and evidence offerings for discovery  | [Registry Manifest](https://docs.registrystack.org/products/registry-manifest/) is a metadata description format, not a Registry Stack product; publishing it grants no access and enforces no policy |

Relay and Evidence Gateway write separate audit records because they own
different boundaries. Relay owns source access and adaptation. Evidence
Gateway owns evidence authorization, evaluation, disclosure, and issuance. Their correlation
identifiers support restricted reconciliation without merging the products into
one undifferentiated log.

For the full technical boundary, read [Records stay
home](https://docs.registrystack.org/explanation/records-stay-home/) and the
[known limitations
inventory](https://docs.registrystack.org/explanation/known-limitations/).

## Review the question before reviewing the API

A useful review can be conducted in this order:

1. **Service review:** Is the public-service job and decision owner clear?
2. **Authority review:** Is the selected registry authoritative for the fact
   being requested?
3. **Disclosure review:** Is the permitted answer the smallest response that
   still supports the service?
4. **Failure review:** Can the consumer distinguish false, missing, ambiguous,
   denied, stale, and unavailable?
5. **Policy review:** Are requester, purpose, scope, and change ownership
   explicit?
6. **Technical review:** Do the routes, claims, mappings, and tests implement
   the agreed question?
7. **Operational review:** Are source freshness, key custody, audit retention,
   incident response, and recovery assigned?

Starting with the API reverses this order. It invites the implementation to set
the policy by accident.

## Signs that the question is still too broad

Return to the worksheet when:

- The answer is “all fields, in case we need them later.”
- The purpose is the name of a department rather than a service activity.
- No institution is named as the decision owner.
- A missing row is treated as proof that the requested fact is false.
- The consumer can submit arbitrary filters or queries that were not reviewed.
- A credential is proposed without a freshness, status, holder, or verifier
  model.
- The phrase “audited access” is used without saying what a reviewer can
  reconstruct.
- The only reviewer is the team writing the integration.

These are not reasons to stop a project. They are reasons to narrow the first
question before building the connection.

## The useful output of the first meeting

A good first scoping meeting does not need to produce an architecture diagram.
It should produce:

- One completed worksheet.
- One named authority and one named decision owner.
- One permitted response and an explicit list of what stays undisclosed.
- A failure-state table.
- A review owner.
- A decision on whether the service needs a protected read, a bounded evidence
  answer, or both.

That is enough to begin a credible technical design. It is also small enough
for policy, programme, registry, security, and integration teams to review the
same object.

The next step is choosing between [Registry Relay](/solutions/protected-registry-apis/)
and [Evidence Gateway](/solutions/evidence-gateway/) for this question, or
combining both where the worksheet calls for it.
