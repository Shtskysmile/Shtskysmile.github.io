# LLM Quantization Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone, interview-oriented model quantization chapter to the LLM review article.

**Architecture:** Edit the existing Markdown article in place. Insert the new chapter after training systems and before job requirements, then renumber the two following chapters and check heading sequence and internal references.

**Tech Stack:** Markdown; existing blog content conventions.

**Spec:** `docs/superpowers/specs/2026-10-22-llm-quantization-chapter-design.md`

## Global Constraints

- Write in the existing Chinese technical-study style.
- Cover model weight quantization and inference deployment; briefly connect KV Cache quantization.
- Explain PTQ/QAT, representative methods, quality and systems metrics, pitfalls, and method selection.
- Avoid universal performance multipliers; results depend on model, calibration data, implementation, and hardware.
- Renumber following chapters and update any affected internal references.

## Review Focus

- Distinguish weight-only from weight-and-activation quantization, and weight quantization from KV Cache quantization.
- Explain GPTQ, AWQ, SmoothQuant, and bitsandbytes paths without conflating their mechanisms.
- Treat quality loss and speed/memory improvement as workload- and hardware-dependent measurements.
- Preserve the document's existing heading and math/table syntax.
- Keep all chapter numbers sequential after insertion.

---

### Task 1: Add and integrate the quantization chapter

**Files:**
- Modify: `content/blog/llm-interview-review.md`

- [ ] Add a standalone section after the current training-systems chapter, with subsections for quantization basics, PTQ versus QAT, common quantization axes/formats, representative methods, evaluation and deployment pitfalls, selection guidance, and interview points.
- [ ] Renumber the existing job requirements and capability-map chapters to follow the insertion; search for and update internal references affected by the change.
- [ ] Review the resulting diff and scan all level-two headings to confirm numbering is sequential and formulas/tables remain well-formed.
