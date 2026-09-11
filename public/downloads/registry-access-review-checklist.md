# Registry access review checklist

Use this checklist for one named service question and one bounded request path.
It complements the Registry Stack field note, "What must a reviewer reconstruct
after registry access?"

## 1. Service context

- [ ] The public service or administrative procedure is named.
- [ ] The institution owning the resulting decision or action is named.
- [ ] The source authority is authoritative for the requested fact.
- [ ] The reviewed question is narrower than general registry access.

## 2. Requester

- [ ] The authentication mode is identified.
- [ ] The requester system or role is identified through the approved review view.
- [ ] The exact scopes exercised are retained.
- [ ] The access mode is understood: machine, subject-bound, representative, or delegated.
- [ ] Raw subject identifiers do not spread through review exports.

## 3. Purpose and policy

- [ ] The request purpose is retained.
- [ ] The requested route or claim is identifiable.
- [ ] The policy identifier, version, or hash is retained.
- [ ] The permit or denial can be explained.
- [ ] The disclosure mode and any redacted fields are identifiable.
- [ ] Policy and configuration changes have a named approval owner.

## 4. Source consultation

- [ ] The dataset and declared route or consultation are identifiable.
- [ ] The source binding and freshness expectation are known.
- [ ] The approved filters and projections can be inspected.
- [ ] Match, no match, ambiguity, denial, and source failure remain distinct.
- [ ] Relay and Evidence Gateway records can be correlated without joining on a raw subject identifier.

## 5. Disclosure

- [ ] The reviewer can distinguish selected fields, aggregate, value, predicate, redacted result, and credential.
- [ ] The returned response contains no excluded field.
- [ ] A plain evaluation result is not described as cryptographically signed.
- [ ] A credential pilot names the holder, binding, status, freshness, wallet, and verifier profile.

## 6. Outcome

- [ ] One allowed request is retained.
- [ ] One denied request is retained.
- [ ] At least one safe uncertainty or failure path is exercised.
- [ ] The consuming service retains its own decision record.

## 7. Audit continuity and operation

- [ ] Relay and Evidence Gateway use separate approved audit keys and chains.
- [ ] Retained chains verify using the deployment procedure.
- [ ] The off-host shipping or anchoring posture matches the stated threat model.
- [ ] Retention, access control, backup, and recovery owners are named.
- [ ] Protected routes expected to fail closed on audit failure are verified.
- [ ] Key custody, transport, monitoring, and incident response are assigned.

## 8. Boundaries recorded

- [ ] Audit evidence is not presented as proof that the source is factually correct.
- [ ] Configuration is not presented as proof of legal authority.
- [ ] A minimized answer is not presented as proof of proper consumer behaviour.
- [ ] A local hash chain is not presented as proof that no tail was removed.
- [ ] Standards-shaped output is not presented as external certification.
