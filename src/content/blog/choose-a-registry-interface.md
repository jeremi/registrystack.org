---
title: 'Do you need the records, or just the answer?'
description: 'Three short questions that decide whether a service should maintain a registry, publish from one, or ask it a question.'
publishedAt: 2026-09-16
author: 'Registry Stack'
audience: 'Programme and service owners, architects, integrators, and registry teams'
category: 'Decision guide'
readingMinutes: 5
order: 2
featured: true
status: published
---

Most registry integrations start with the wrong question. "Which API do we
need?" assumes the answer is an API. Two questions come first: who maintains the
records, and what does the service actually need from them?

Registry Stack has a product for each. **Base Registry Engine maintains records.
Evidence Gateway answers questions about them.** Many services need both.

## 1. Does anyone maintain these records?

When a record is wrong, who corrects it?

If a named team with a system they control: go to question 2.

If nobody, or three systems that disagree, or a spreadsheet one person keeps:
stop. **An API over an unmaintained source does not fix the errors. It
distributes them, with an institutional stamp.**

That is the case for **Base Registry Engine**. The institution declares what
records exist, how they relate, who may change them and who may read them; the
engine provides storage, history, access control and the API. It has no built-in
idea of what a registry is about, so a permit registry and a household registry
are set up the same way.

*A regulator tracks permits in a shared spreadsheet.* Declare permits, holders
and status changes in Base Registry Engine first. Decide who else may see them
second.

## 2. Does the service need records? How many?

Most services ask for records and need an answer about one person, one facility
or one licence.

*A school-meal service needs to know whether a child has an active enrolment.*
It does not need the household record, and if it receives one it has to protect
it.

That is **Evidence Gateway**. The registry owner writes the questions it is
willing to answer and what each answer may contain. A service asks one; the
gateway checks who is asking and why, consults the registry, and **returns the
answer and nothing more**. The school-meal service gets "active enrolment: yes",
keeps its own decision, and never sees the household.

Some services do need records: a partner looks up a facility by identifier, a
statistics team receives licensed facilities by district each month. That is
publication, and the registry owner decides it deliberately, field by field. In
Base Registry Engine the owner declares what each kind of reader may see, and
the API serves that and nothing else. **A service that needs many records,
regularly, is asking for a copy.** Sometimes that is right, and it belongs in a
data-sharing agreement before it belongs in an API.

## 3. What should the answer contain?

The registry decides, when the question is written, what the answer may say and
to whom: a yes or no, a value, or a few fields, each released only to callers
entitled to it.

*A civil registry is asked whether a person is registered as a parent of a
child.* Most callers get yes or no. A caller the registry has authorised also
gets the recorded parent identifiers. One registered birth, two answers, decided
in advance by the registry rather than at the time by the caller.

*A service needs a birth extract.* The registry answers with given name, family
name, date and place of birth, each disclosable on its own. A service that only
needs to know whether the person is an adult should not ask for the extract; it
should ask that.

An answer can also be returned as a verifiable credential a person can carry and
show elsewhere. Evidence Gateway produces it; the apps that hold it, the parties
that check it and its withdrawal are a separate programme. The
[birth certificate tutorial](https://docs.registrystack.org/tutorials/issue-a-birth-certificate-vc-from-opencrvs/)
shows the boundary.

**So the test for an answer: it contains what the service needs to act, and
nothing the service would then have to protect.** A question written too
generously fails that test, which is why reviewing the question is where the
effort goes. What the service does with the answer stays with the service.

## Design for "cannot answer"

**"Cannot answer" is not "no".** Only one outcome is a no: the registry found
the person and the fact is negative. No match, several matches, a refused
request, out-of-date information or no response mean the service cannot proceed
yet. Nobody should be turned away by a timeout.

The service will not always learn which happened, because telling the wrong
caller the difference between "no such person" and "not permitted" reveals that
the person exists. **Give "could not answer" its own place in the workflow**:
neither an error to retry nor a refusal to act on.

## Choosing

**Nobody maintains the records:** Base Registry Engine. **The service needs an
answer:** Evidence Gateway. **The service needs records:** publish them
deliberately, field by field. Registry Relay, Casework, Manifest and Discovery
have their own pages.

Check against the [Base Registry Engine](/solutions/base-registry/) and
[Evidence Gateway](/solutions/evidence-gateway/) pages and the
[known limitations](https://docs.registrystack.org/explanation/known-limitations/).
If the service question is still fuzzy, start with
[Before you connect a registry, define the question](/blog/before-you-connect-a-registry-define-the-question/).
