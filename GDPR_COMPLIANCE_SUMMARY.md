# OpenCode GDPR Compliance Assessment - Executive Summary

## Status: ⚠️ CRITICAL - Multiple High-Risk Gaps Identified

### Key Findings

**Compliance Score: 15/100** (estimated current state)

- Required for European market deployment: 85+

### Critical Gaps (Immediate Action Required)

1. **No Audit Logging System** (Art. 30)
   - Cannot demonstrate what data flows where
   - Unable to prove compliance to regulators
   - **Risk**: €20M+ fine or 4% global revenue

2. **No Consent Mechanism** (Art. 6, 7)
   - Users may not know code is sent to external APIs
   - No ability to withdraw consent
   - **Risk**: Unlawful processing, €20M+ fine

3. **No Privacy Notice/Transparency** (Art. 13, 14)
   - Users uninformed about data usage
   - Missing data subject rights information
   - **Risk**: Violation reported to authorities

4. **Missing Data Processing Agreements** (Art. 28)
   - External AI providers (OpenAI, Anthropic) may be uncontracted
   - OpenCode liable for processor non-compliance
   - **Risk**: Processing declared unlawful

### High-Severity Gaps (3-6 Month Timeline)

5. **No Data Deletion/User Rights Tools** (Art. 15-21)
6. **No Security Safeguards** (Art. 32) - encryption, access control
7. **No Data Transfer Mechanisms** (Art. 44-50) - Schrems II compliance
8. **No Breach Response Plan** (Art. 33, 34)
9. **Automated Decision-Making Gaps** (Art. 22) - if used without transparency
10. **Missing Data Protection Impact Assessment** (Art. 35)

---

## Required Implementation Roadmap

### Phase 1: Foundation (Weeks 1-8)

- [ ] Audit all external data processors and obtain/execute DPAs
- [ ] Document lawful basis for each processing activity
- [ ] Implement centralized audit logging (session → provider → destination)
- [ ] Create Privacy Notice + publish on website

**Deliverables**: DPA register, Privacy Policy, Audit log schema, Consent store design

### Phase 2: Consent & Transparency (Weeks 9-16)

- [ ] Build Consent Module (per-provider toggles, record storage)
- [ ] Implement Privacy Dashboard (user rights, data access, consent mgmt)
- [ ] Onboarding wizard (consent flow)
- [ ] In-app transparency (API call notifications before external transfer)

**Deliverables**: Consent UI, Privacy Dashboard, Onboarding flow

### Phase 3: User Rights (Weeks 17-24)

- [ ] Data Access API (export personal data in structured format)
- [ ] Data Deletion API (soft/hard delete with audit trail)
- [ ] Data Rectification UI
- [ ] Right to Object/Restriction features

**Deliverables**: Rights Management API, Dashboard features

### Phase 4: Security & Governance (Weeks 25-32)

- [ ] End-to-end encryption for external API calls (optional per user)
- [ ] Breach response plan + incident log
- [ ] Access control & RBAC implementation
- [ ] DPIA documentation + annual review process

**Deliverables**: Security audit, Incident response SOP, DPA compliance certification

---

## Regulatory Context

### GDPR Scope

- Applies to all processing of EU residents' personal data
- Fines: €20M or 4% global annual turnover (whichever higher)
- Supervisory authorities: National DPAs in each EU country

### EU AI Act (Effective Aug 2, 2026)

- If OpenCode's code suggestions constitute "high-risk" automated decisions:
  - Requires Risk Management System (Art. 9)
  - Mandatory Technical Documentation (Art. 11)
  - Automatically Generated Logs (Art. 19)
  - Human Oversight (Art. 14)
  - Transparency & Disclosure (Art. 13, 50)

### Schrems II Implication (2020 CJEU Ruling)

- EU → US data transfers require **supplementary safeguards** beyond Standard Contractual Clauses
- Example: Client-side encryption, data minimization, vendor transparency commitments
- Failure to implement = data transfer deemed unlawful

---

## Provider Compliance Checklist

| Provider       | DPA Status | Legal Basis         | Safeguards                | Notes                                   |
| -------------- | ---------- | ------------------- | ------------------------- | --------------------------------------- |
| OpenAI         | ❓ Verify  | Consent             | SCC + supplement?         | Check DPA, verify US transfer mechanism |
| Anthropic      | ❓ Verify  | Consent             | SCC + supplement?         | Same as OpenAI                          |
| GitHub Copilot | ❓ Verify  | Consent             | Covered by Microsoft DPA? | Verify if MSFT DPA covers GitHub        |
| Local LLM      | ✅ N/A     | Legitimate Interest | None needed               | No external transfer                    |

---

## Financial Impact Projection

### Costs of Compliance (Estimate)

- Audit + legal review: €10k-20k
- Engineering (6-8 months): €120k-180k (engineering salary burden)
- Compliance tooling: €5k-15k (logging, encryption libraries)
- **Total**: €135k-215k

### Costs of Non-Compliance (If Fined)

- Regulatory fine: **€20M minimum** or 4% revenue
- Reputational damage: Loss of EU market entry
- Legal defense: €100k-500k
- Class action liability: Potentially €10M+ (if users sue for data misuse)

**ROI**: Compliance cost is negligible vs. fine exposure

---

## Recommended Next Steps

### Week 1: Decision & Planning

1. **Board/Leadership**: Confirm commitment to EU market compliance
2. **Legal**: Engage data protection attorney to review assessment
3. **Product**: Create compliance roadmap with stakeholders
4. **Engineering**: Assign lead for audit logging system design

### Week 2-4: Audit Phase

1. **Procurement**: Obtain & review DPAs from all external providers
2. **Architecture**: Map data flows (code → provider → response → storage)
3. **Legal**: Document lawful basis for each processing activity
4. **Compliance**: Design audit log schema (fields, retention, security)

### Week 5-8: Foundation Delivery

1. Deploy audit logging to production (non-blocking, shadow mode OK)
2. Publish Privacy Policy + Privacy Notice
3. Finalize DPAs and provider agreements
4. Design consent module UI/UX

### Ongoing: Governance

- Monthly compliance check-ins
- Quarterly privacy impact assessments
- Annual DPA reviews + processor audits
- Training: Team members on GDPR obligations

---

## Resources

**Full Assessment**: `GDPR_COMPLIANCE_ASSESSMENT.json` (in this repo)

**Key GDPR Articles**:

- Art. 5: Data Protection Principles (Lawfulness, Fairness, Transparency, Purpose Limitation, Data Minimization, Accuracy, Storage Limitation, Integrity & Confidentiality)
- Art. 6-7: Lawfulness & Consent
- Art. 13-15: Transparency & User Rights
- Art. 28: Data Processor Requirements
- Art. 30: Audit Logging
- Art. 32: Security
- Art. 33-34: Breach Notification

**Guides**:

- EDPB Guidelines 05/2020 on Consent (https://edpb.ec.europa.eu/our-work-tools/our-documents/guidelines_en)
- Schrems II Guidance (https://edpb.ec.europa.eu/our-work-tools/cpft_en)
- AI Act (https://ai-act-law.eu/)

---

## Questions for Leadership

1. **Market Priority**: Is EU market entry a strategic goal? If yes, full compliance required.
2. **Data Controller Role**: Does OpenCode own/control user data, or is user the controller (delegated to provider)?
3. **Training Data**: Will user code ever be used to train models? (Separate consent + legal basis required)
4. **Processor Selection**: Should users choose provider, or OpenCode default to single provider?
5. **Local Option**: Should local-only mode (no external APIs) be available for privacy-conscious users?

---

**Assessment Date**: February 4, 2026  
**Assessment Scope**: GDPR + EU AI Act (draft)  
**Next Review**: Quarterly or upon significant feature changes
