# GDPR Compliance Quick Reference - OpenCode

## 🚨 Critical Issues (Fix First - 8 weeks)

| Issue             | Article   | Impact                 | Action                         |
| ----------------- | --------- | ---------------------- | ------------------------------ |
| No audit logs     | Art. 30   | Can't prove compliance | Build logging middleware       |
| No consent UI     | Art. 6, 7 | Unlawful processing    | Add consent dialog + toggle    |
| No privacy notice | Art. 13   | Users uninformed       | Publish privacy policy         |
| Missing DPAs      | Art. 28   | Processor liability    | Audit providers, get contracts |

## 📋 Key GDPR Principles for AI Assistants

**Art. 5 - Six Core Principles**:

1. **Lawfulness** → Need legal basis (consent, contract, legitimate interest)
2. **Fairness** → No manipulation/dark patterns
3. **Transparency** → Tell users what you do with their data
4. **Purpose Limitation** → Only use for stated purposes
5. **Data Minimization** → Collect only what you need
6. **Accuracy** → Keep data correct

## 🔐 Must-Have Safeguards

```
Data Flow → Audit Log (WHO, WHAT, WHEN, WHERE, WHY)
Code Snippet → [Encrypted?] → External API → [Log entry] → User notified
```

**Logging fields** (required Art. 30):

- Timestamp
- User ID
- Provider ID & model
- Data classification (sensitive/general)
- API call result (success/fail)
- Retention period

## ✋ User Rights to Implement (Art. 15-21)

| Right         | What User Needs                | Deadline    |
| ------------- | ------------------------------ | ----------- |
| Access        | Download all their data (JSON) | 30 days     |
| Rectification | Fix incorrect info             | 30 days     |
| Erasure       | Delete all data                | 30 days     |
| Portability   | Export to other service        | 30 days     |
| Restrict      | Pause processing temporarily   | Immediately |
| Object        | Opt-out of specific uses       | Immediately |

## 💬 Consent Do's and Don'ts

**✅ DO:**

- Ask for specific permission per use case
- Make it easy to withdraw (one-click)
- Record consent with timestamp
- Default to minimal consent
- Explain what will happen

**❌ DON'T:**

- Bundle consent with service (must be separate)
- Use pre-checked boxes
- Make withdrawal harder than consent
- Use vague language ("improve service")
- Share data for training without separate consent

## 🌍 International Transfers (US Providers)

**Issue**: Schrems II (2020) says Standard Contractual Clauses (SCCs) alone insufficient for US transfers

**Required**:

1. Check if DPA has proper SCCs
2. Add supplementary safeguards:
   - Encrypt before transfer (client-side)
   - Minimize data sent (only necessary code)
   - User can opt out
3. Document in privacy notice

## 🚨 Breach Response (72-hour rule)

**If security incident** with personal data exposure:

1. **Hour 0**: Detect & contain breach
2. **Hour 24**: Assess impact
3. **Hour 72**: Notify supervisory authority (DPA) if high risk
4. **Without undue delay**: Notify affected users

**Log it**: Maintain breach register (incident, cause, impact, remediation)

## 📊 Provider Tracking Template

```json
{
  "provider": "OpenAI",
  "model": "gpt-4",
  "dpa_status": "Executed Jan 2026",
  "legal_basis": "User Consent",
  "data_types": ["code", "prompts"],
  "retention": "30 days per OpenAI terms",
  "transfer_mechanism": "Standard Contractual Clauses + encryption",
  "user_opt_in": true,
  "audit_logging": "API calls logged, code content NOT logged"
}
```

## ⚖️ Penalties for Non-Compliance

| Violation                | Fine                        |
| ------------------------ | --------------------------- |
| Missing consent          | €20M or 4% revenue          |
| No audit logs            | €20M or 4% revenue          |
| No DPA with processor    | €20M or 4% revenue          |
| Slow breach notification | €10-20M or up to 2% revenue |
| Missing privacy notice   | €5-10M or up to 1% revenue  |

## 📅 Compliance Timeline (Priority Order)

**Week 1**: Audit DPA status of each provider
**Week 2-4**: Document data flows, publish privacy notice
**Week 4-8**: Implement consent UI
**Week 8-12**: Add audit logging
**Week 12-16**: Build user rights dashboard
**Week 16-24**: Security hardening (encryption, incident response)

## 🔗 Useful Regulatory Resources

- **GDPR Text**: https://gdpr-info.eu/
- **EDPB Guidance**: https://edpb.ec.europa.eu/our-work-tools/our-documents/guidelines_en
- **Schrems II Guidance**: https://edpb.ec.europa.eu/sites/default/files/2021-06/edpb_20210620_supplementary_measures_tcs_en_0.pdf
- **AI Act**: https://ai-act-law.eu/ (effective Aug 2, 2026)
- **Your Local DPA**: (each EU country has one - e.g., GDPR-Forum.de for Germany, CNIL for France)

## ❓ Key Questions to Ask Vendors

1. **DPA Status**: "Do you have an executed Data Processing Agreement with GDPR-compliant terms?"
2. **SCCs + Supplements**: "What supplementary safeguards do you provide for EU→US transfers?"
3. **Training Data**: "Will our code be used to train your models?"
4. **Subprocessors**: "Who are your subprocessors and what do they do with data?"
5. **User Rights**: "How do we submit user access/deletion requests?"
6. **Breach Response**: "What's your incident response SLA?"

---

**Last Updated**: February 4, 2026  
**Full Assessment**: See `GDPR_COMPLIANCE_ASSESSMENT.json` + `GDPR_COMPLIANCE_SUMMARY.md`  
**Questions**: Consult GDPR lawyer before deployment
