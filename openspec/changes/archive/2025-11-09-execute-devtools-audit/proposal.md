# Proposal: Execute DevTools Audit via MCP Tool

**Change ID**: `execute-devtools-audit`
**Status**: Draft
**Created**: 2025-11-09
**Author**: Claude Code

## Problem Statement

The current Feature 007 (Chrome DevTools Audit) created comprehensive documentation for **manual** audit execution. However, we now have access to the Chrome DevTools MCP tool (`mcp__chrome-devtools__*` functions) that can **automate** the audit execution process.

**Current State**:
- ✅ Documentation complete: EXECUTION_GUIDE.md, CONFIGURATION.md, research.md
- ✅ Templates created: report-template.md
- ❌ Audits NOT yet executed (requires manual browser interaction per documentation)
- ❌ No baseline metrics recorded
- ❌ No issues documented from actual audit runs

**Opportunity**:
The Chrome DevTools MCP tool provides programmatic access to:
- `list_pages`: Enumerate browser tabs
- `navigate_page`: Load application URL
- `take_snapshot`: Capture accessibility tree
- `list_console_messages`: Detect JavaScript errors
- `list_network_requests`: Analyze performance (request timing, resource sizes)
- Performance analysis capabilities

## Proposed Solution

**Execute automated audits** using Chrome DevTools MCP tool to:
1. **Launch application** in browser via MCP
2. **Capture performance metrics** (page load timing, resource sizes)
3. **Detect accessibility issues** (via snapshot analysis)
4. **Record console errors** (JavaScript issues)
5. **Analyze network performance** (render-blocking resources)
6. **Document findings** in standardized audit report format

**Scope**:
- Automate audit execution for Performance and Accessibility categories
- Record baseline metrics in JSON format per FR-007
- Generate initial audit report using report-template.md
- Document identified issues for remediation

**Out of Scope** (requires full Lighthouse API):
- SEO audit (meta tags, structured data)
- PWA audit (service worker, manifest validation)
- Best Practices scoring (requires Lighthouse-specific heuristics)

## User Value

**For QA Team**:
- Automated baseline audit execution (saves ~30 minutes manual work)
- Consistent, reproducible measurements
- Immediate issue identification

**For Development Team**:
- Concrete performance metrics to guide optimization
- Accessibility violations to fix
- Network waterfall analysis for render-blocking resources

**For Product Owners**:
- Baseline quality metrics for tracking improvements
- Actionable issue list with priorities

## Success Criteria

1. ✅ Application successfully loaded in Chrome DevTools MCP
2. ✅ Performance metrics captured (page load time, resource count, total bytes)
3. ✅ Accessibility snapshot generated and analyzed
4. ✅ Console errors detected and categorized
5. ✅ Network requests analyzed (render-blocking resources identified)
6. ✅ Audit report generated in `audit-reports/2025-11-09-mcp-audit.json`
7. ✅ Issues documented with severity levels and remediation guidance

## Affected Capabilities

- **NEW**: `automated-audit-execution` - Use Chrome DevTools MCP tool to execute audits

## Dependencies

- Chrome DevTools MCP server must be running and connected
- Application dev server must be accessible at http://localhost:5173
- Existing audit documentation from Feature 007

## Risks & Mitigations

**Risk 1**: MCP tool may not provide full Lighthouse scoring
- **Mitigation**: Focus on raw metrics (performance timing, accessibility issues) rather than scores
- **Fallback**: Manual Lighthouse audit still available per EXECUTION_GUIDE.md

**Risk 2**: Browser may not be running or MCP server disconnected
- **Mitigation**: Verify `list_pages` works before proceeding
- **Error Handling**: Clear error messages guiding user to start browser/MCP

**Risk 3**: Network timing may vary between runs
- **Mitigation**: Run multiple measurements, report ranges
- **Documentation**: Note variability in audit report

## Open Questions

1. Should we run audits on multiple pages (homepage, dashboard) or just homepage?
   - **Recommendation**: Start with homepage only (http://localhost:5173/)

2. What threshold should we use for "critical" vs "warning" issues?
   - **Recommendation**: Use WCAG 2.1 Level A = Critical, Level AA = Warning

3. Should we capture screenshots of identified issues?
   - **Recommendation**: Yes, use `take_screenshot` for visual evidence

## Next Steps

1. Review and approve this proposal
2. Create implementation tasks in `tasks.md`
3. Execute automated audit via MCP
4. Generate audit report
5. Review findings and prioritize remediation
