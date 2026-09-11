import jsPDF from 'jspdf';
import { Runbook, Task } from '../types';

export interface PdfExportOptions {
  companyName?: string;
  department?: string;
  includeCliSnippets?: boolean;
  includeRca?: boolean;
  includeRollback?: boolean;
  includeSignoff?: boolean;
}

export function exportRunbookToPdf(runbook: Runbook, options: PdfExportOptions = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const company = options.companyName || 'ENTERPRISE IT OPERATIONS & SRE';
  const dept = options.department || 'Infrastructure Engineering & Incident Response';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = margin + 10;
      // Re-draw subtle top running header
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 150, 165);
      doc.text(`${company} — ${runbook.code}: ${runbook.title.slice(0, 45)}...`, margin, margin);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, margin, { align: 'right' });
      doc.setDrawColor(220, 226, 235);
      doc.line(margin, margin + 2, pageWidth - margin, margin + 2);
      y += 6;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(company.toUpperCase(), margin + 6, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`${dept} | Standard Operating Procedure (SOP)`, margin + 6, y + 13);

  // Code & Version
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${runbook.code} | v${runbook.version}`, pageWidth - margin - 6, y + 18, { align: 'right' });

  y += 30;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  const splitTitle = doc.splitTextToSize(runbook.title, contentWidth);
  doc.text(splitTitle, margin, y);
  y += splitTitle.length * 7 + 2;

  // Metadata Grid Table
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CATEGORY:', margin + 4, y + 6);
  doc.text('TARGET ENV:', margin + 50, y + 6);
  doc.text('AUTHOR / OWNER:', margin + 98, y + 6);
  doc.text('LAST UPDATED:', margin + 145, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(runbook.category, margin + 4, y + 13);
  doc.text(runbook.environment, margin + 50, y + 13);
  doc.text(`${runbook.author} (${runbook.authorRole || 'Lead'})`, margin + 98, y + 13);
  doc.text(runbook.lastUpdated, margin + 145, y + 13);

  y += 26;

  // Section 1: Symptom & Trigger Patterns
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('1. SYMPTOMS & TRIGGER SIGNATURES', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const symptomText = doc.splitTextToSize(runbook.symptom, contentWidth - 4);
  doc.text(symptomText, margin + 2, y);
  y += symptomText.length * 4.5 + 4;

  if (runbook.triggerAlertPatterns && runbook.triggerAlertPatterns.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Matched Alert Patterns:', margin + 2, y);
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28); // red-700
    for (const pattern of runbook.triggerAlertPatterns) {
      doc.text(`• ${pattern}`, margin + 5, y);
      y += 4;
    }
    y += 2;
  }

  // Section 2: Root Cause Analysis
  if (options.includeRca !== false && runbook.rootCauseAnalysis) {
    checkPageBreak(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('2. ROOT CAUSE ANALYSIS (RCA)', margin, y);
    y += 5;

    doc.setFillColor(241, 245, 249);
    const rcaLines = doc.splitTextToSize(runbook.rootCauseAnalysis, contentWidth - 8);
    const boxHeight = rcaLines.length * 4.5 + 6;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(rcaLines, margin + 4, y + 5);
    y += boxHeight + 6;
  }

  // Section 3: Diagnostic Steps
  if (runbook.diagnosticSteps && runbook.diagnosticSteps.length > 0) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('3. DIAGNOSTIC WORKFLOW & TRIAGE CLI', margin, y);
    y += 6;

    runbook.diagnosticSteps.forEach((diag, index) => {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`3.${index + 1} ${diag.title} [${diag.shellType.toUpperCase()}]`, margin + 2, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const expLines = doc.splitTextToSize(diag.explanation, contentWidth - 6);
      doc.text(expLines, margin + 4, y);
      y += expLines.length * 3.8 + 2;

      // Terminal Box
      if (diag.cli) {
        doc.setFillColor(15, 23, 42); // slate-900
        const cliLines = doc.splitTextToSize(diag.cli, contentWidth - 10);
        const cliBoxHeight = cliLines.length * 4.2 + 5;
        doc.roundedRect(margin + 2, y, contentWidth - 4, cliBoxHeight, 1, 1, 'F');

        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(56, 189, 248); // sky-400
        doc.text(cliLines, margin + 5, y + 4.5);
        y += cliBoxHeight + 5;
      }
    });
  }

  // Section 4: Remediation Workflow
  if (runbook.remediationSteps && runbook.remediationSteps.length > 0) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('4. STEP-BY-STEP REMEDIATION PROCEDURES', margin, y);
    y += 6;

    runbook.remediationSteps.forEach((step) => {
      checkPageBreak(35);
      // Danger Indicator
      if (step.dangerous) {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
        doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(185, 28, 28);
        doc.text('⚠️ CRITICAL / HIGH-RISK ACTION: REQUIRES PEER ACKNOWLEDGMENT', margin + 4, y + 4.2);
        y += 8;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Step ${step.stepNumber}: ${step.title}`, margin + 2, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const instLines = doc.splitTextToSize(step.instruction, contentWidth - 6);
      doc.text(instLines, margin + 4, y);
      y += instLines.length * 4 + 2;

      if (step.command) {
        doc.setFillColor(30, 41, 59); // slate-800
        const cmdLines = doc.splitTextToSize(step.command, contentWidth - 10);
        const cmdBoxHeight = cmdLines.length * 4.2 + 5;
        doc.roundedRect(margin + 2, y, contentWidth - 4, cmdBoxHeight, 1, 1, 'F');

        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(134, 239, 172); // green-300
        doc.text(cmdLines, margin + 5, y + 4.5);
        y += cmdBoxHeight + 4;
      }

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(16, 149, 193);
      doc.text(`Verification: ${step.verification}`, margin + 4, y);
      y += 7;
    });
  }

  // Section 5: Rollback Plan
  if (options.includeRollback !== false && runbook.rollbackPlan) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text('5. ROLLBACK & DISASTER SAFEGUARD PROTOCOL', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const rollbackLines = doc.splitTextToSize(runbook.rollbackPlan, contentWidth - 4);
    doc.text(rollbackLines, margin + 2, y);
    y += rollbackLines.length * 4 + 6;
  }

  // Section 6: Post-Mortem & Preventative Maintenance
  if (runbook.postMortemChecklist && runbook.postMortemChecklist.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('6. POST-INCIDENT PREVENTATIVE ACTION ITEMS', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    runbook.postMortemChecklist.forEach((item) => {
      doc.text(`[  ] ${item}`, margin + 4, y);
      y += 5;
    });
    y += 4;
  }

  // Sign-off section
  if (options.includeSignoff !== false) {
    checkPageBreak(30);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('INCIDENT COMMANDER SIGN-OFF', margin, y);
    doc.text('LEAD SRE / ARCHITECT REVIEW', margin + 60, y);
    doc.text('SECURITY & COMPLIANCE STAMP', margin + 120, y);

    y += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Signature: ___________________', margin, y);
    doc.text('Signature: ___________________', margin + 60, y);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, margin + 120, y);
  }

  // Save PDF
  const filename = `${runbook.code}_${runbook.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`;
  doc.save(filename);
}

export function exportAllHandbookToPdf(runbooks: Runbook[], companyName = 'ENTERPRISE IT OPERATIONS') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Cover Page
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text('IT OPERATIONS RUNBOOK', margin + 6, 70);
  doc.setTextColor(255, 255, 255);
  doc.text('& ISSUE-SOLUTION HANDBOOK', margin + 6, 82);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text('Standard Operating Procedures, Outage Remediation & Disaster Recovery Manual', margin + 6, 95);

  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(1.5);
  doc.line(margin + 6, 105, margin + 70, 105);

  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`ORGANIZATION: ${companyName}`, margin + 6, 180);
  doc.text(`TOTAL RUNBOOKS: ${runbooks.length} Active Procedures`, margin + 6, 188);
  doc.text(`DOCUMENT VERSION: 2026.Q3`, margin + 6, 196);
  doc.text(`EXPORT DATE: ${new Date().toUTCString()}`, margin + 6, 204);

  // Table of Contents Page
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let y = margin + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('TABLE OF CONTENTS', margin, y);
  y += 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  runbooks.forEach((rb, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${idx + 1}. [${rb.code}] ${rb.title.slice(0, 55)}`, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${rb.category} | ${rb.environment}`, margin + 6, y + 4.5);

    y += 12;
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }
  });

  // Save Full Manual PDF
  const filename = `IT_Ops_Issue_Solution_Handbook_Full_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function exportIncidentPostMortemPdf(task: Task, companyName = 'ENTERPRISE IT OPERATIONS') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(56, 189, 248);
  doc.text(`${companyName} — POST-MORTEM & INCIDENT REPORT`, margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`TICKET ID: ${task.ticketNumber} | STATUS: ${task.status.toUpperCase()}`, margin + 6, y + 15);

  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const splitTitle = doc.splitTextToSize(task.title, contentWidth);
  doc.text(splitTitle, margin, y);
  y += splitTitle.length * 6.5 + 4;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ENVIRONMENT:', margin + 4, y + 6);
  doc.text('CATEGORY:', margin + 55, y + 6);
  doc.text('AFFECTED USERS:', margin + 145, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(task.environment, margin + 4, y + 13);
  doc.text(task.category, margin + 55, y + 13);
  doc.text(`${task.affectedUsersEstimate ? task.affectedUsersEstimate.toLocaleString() : 'N/A'} users`, margin + 145, y + 13);

  y += 28;

  // Description
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('1. INCIDENT DESCRIPTION & TIMELINE', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const descLines = doc.splitTextToSize(task.description, contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 4.5 + 6;

  // Checklist of actions performed
  if (task.checklist && task.checklist.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('3. RESOLUTION TASKS EXECUTED', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    task.checklist.forEach((item) => {
      const mark = item.done ? '[X]' : '[  ]';
      doc.text(`${mark} ${item.text}`, margin + 2, y);
      y += 4.5;
      if (item.command) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`   CLI: ${item.command}`, margin + 4, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
      }
    });
    y += 4;
  }

  // Resolution Notes
  if (task.resolutionNotes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('4. FINAL RESOLUTION & RECOVERY NOTES', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const resLines = doc.splitTextToSize(task.resolutionNotes, contentWidth);
    doc.text(resLines, margin, y);
    y += resLines.length * 4.5 + 6;
  }

  const filename = `Incident_Report_${task.ticketNumber}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export { exportAllHandbookToPdf as exportHandbookToPdf };
