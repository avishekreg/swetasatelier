import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Calculator, Download, FileSpreadsheet, FileText, Landmark, Plus, ReceiptIndianRupee, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AccountsSettings, AccountingEntry, GSTTaxMode, GSTRate, InvoicePaymentStatus, Order } from '../../types';
import { AccountsService, OrderService } from '../../services/storeService';
import AdminAccessNotice from '../../components/AdminAccessNotice';
import AdminShell from '../../components/AdminShell';

const defaultSettings: AccountsSettings = {
  legalName: "Sweta's Atelier",
  tradeName: "Sweta's Atelier",
  gstin: '',
  stateCode: '27',
  stateName: 'Maharashtra',
  invoicePrefix: 'SWA',
  nextInvoiceNumber: 1,
  financialYearLabel: '2026-27',
  defaultGstRate: 5,
  defaultTaxMode: 'intra_state',
};

const emptyEntryForm = {
  sourceOrderId: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  customerName: '',
  customerEmail: '',
  customerGstin: '',
  placeOfSupply: 'Maharashtra',
  itemSummary: '',
  taxableAmount: 0,
  gstRate: 5 as GSTRate,
  taxMode: 'intra_state' as GSTTaxMode,
  paymentStatus: 'unpaid' as InvoicePaymentStatus,
  paymentMethod: 'Bank Transfer',
  notes: '',
};

type EntryForm = typeof emptyEntryForm;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateTaxes(taxableAmount: number, gstRate: number, taxMode: GSTTaxMode) {
  const totalTax = round2((taxableAmount * gstRate) / 100);
  if (taxMode === 'inter_state') {
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTax,
      totalAmount: round2(taxableAmount + totalTax),
    };
  }

  const halfTax = round2(totalTax / 2);
  return {
    cgstAmount: halfTax,
    sgstAmount: round2(totalTax - halfTax),
    igstAmount: 0,
    totalAmount: round2(taxableAmount + totalTax),
  };
}

function timestampToDate(value: any) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildInvoiceNumber(settings: AccountsSettings) {
  return `${settings.invoicePrefix}-${String(settings.nextInvoiceNumber).padStart(4, '0')}`;
}

function orderSummary(order: Order) {
  return order.items
    .map((item, index) => `${index + 1}. ${item.type === 'stitched' ? 'Stitched couture' : 'Fabric / material'} x${item.quantity}`)
    .join(' | ');
}

const AdminAccounts = () => {
  const { canAccessAccounts } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<AccountsSettings>(defaultSettings);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [savedSettings, savedEntries, allOrders] = await Promise.all([
        AccountsService.getSettings(),
        AccountsService.getEntries(),
        OrderService.getAllOrders(),
      ]);
      setSettings(savedSettings ?? defaultSettings);
      setEntries(savedEntries ?? []);
      setOrders(allOrders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the accounts suite right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const invoicePreview = useMemo(() => {
    const taxes = calculateTaxes(Number(entryForm.taxableAmount) || 0, Number(entryForm.gstRate) || 0, entryForm.taxMode);
    return {
      invoiceNumber: buildInvoiceNumber(settings),
      ...taxes,
    };
  }, [entryForm.gstRate, entryForm.taxMode, entryForm.taxableAmount, settings]);

  const summary = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.taxable += Number(entry.taxableAmount) || 0;
        acc.cgst += Number(entry.cgstAmount) || 0;
        acc.sgst += Number(entry.sgstAmount) || 0;
        acc.igst += Number(entry.igstAmount) || 0;
        acc.total += Number(entry.totalAmount) || 0;
        if (entry.paymentStatus === 'paid') acc.paid += Number(entry.totalAmount) || 0;
        if (entry.paymentStatus !== 'paid') acc.outstanding += Number(entry.totalAmount) || 0;
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, paid: 0, outstanding: 0 }
    );
  }, [entries]);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await AccountsService.saveSettings(settings);
      setSuccess('Accounts settings saved. GST profile and invoice numbering are ready for operations.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save accounting settings.');
    } finally {
      setSaving(false);
    }
  };

  const useOrder = (orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    setEntryForm((current) => ({
      ...current,
      sourceOrderId: order.id,
      customerName: current.customerName || `Customer ${order.userId.slice(-6)}`,
      itemSummary: orderSummary(order),
      taxableAmount: Number(order.totalAmount) || 0,
    }));
  };

  const saveEntry = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const computed = calculateTaxes(Number(entryForm.taxableAmount), Number(entryForm.gstRate), entryForm.taxMode);
      await AccountsService.addEntry({
        sourceOrderId: entryForm.sourceOrderId || undefined,
        invoiceNumber: buildInvoiceNumber(settings),
        invoiceDate: entryForm.invoiceDate,
        customerName: entryForm.customerName,
        customerEmail: entryForm.customerEmail || undefined,
        customerGstin: entryForm.customerGstin || undefined,
        placeOfSupply: entryForm.placeOfSupply,
        itemSummary: entryForm.itemSummary,
        taxableAmount: Number(entryForm.taxableAmount),
        gstRate: entryForm.gstRate,
        taxMode: entryForm.taxMode,
        cgstAmount: computed.cgstAmount,
        sgstAmount: computed.sgstAmount,
        igstAmount: computed.igstAmount,
        totalAmount: computed.totalAmount,
        paymentStatus: entryForm.paymentStatus,
        paymentMethod: entryForm.paymentMethod,
        notes: entryForm.notes || undefined,
      });
      const nextSettings = { ...settings, nextInvoiceNumber: settings.nextInvoiceNumber + 1 };
      await AccountsService.saveSettings(nextSettings);
      setSettings(nextSettings);
      setEntryForm({ ...emptyEntryForm, invoiceDate: new Date().toISOString().slice(0, 10), gstRate: nextSettings.defaultGstRate, taxMode: nextSettings.defaultTaxMode, placeOfSupply: nextSettings.stateName });
      setSuccess('Invoice entry saved to the boutique accounts register.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this accounts entry.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await AccountsService.deleteEntry(id);
      setSuccess('Accounting entry deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this accounts entry.');
    } finally {
      setSaving(false);
    }
  };

  const exportRows = entries.map((entry) => ({
    invoiceNumber: entry.invoiceNumber,
    invoiceDate: entry.invoiceDate,
    customerName: entry.customerName,
    customerEmail: entry.customerEmail || '',
    customerGSTIN: entry.customerGstin || '',
    placeOfSupply: entry.placeOfSupply,
    itemSummary: entry.itemSummary,
    taxableAmount: entry.taxableAmount,
    gstRate: entry.gstRate,
    taxMode: entry.taxMode,
    cgstAmount: entry.cgstAmount,
    sgstAmount: entry.sgstAmount,
    igstAmount: entry.igstAmount,
    totalAmount: entry.totalAmount,
    paymentStatus: entry.paymentStatus,
    paymentMethod: entry.paymentMethod,
    notes: entry.notes || '',
    sourceOrderId: entry.sourceOrderId || '',
  }));

  const downloadCsv = () => {
    const headers = Object.keys(exportRows[0] || {
      invoiceNumber: '', invoiceDate: '', customerName: '', customerEmail: '', customerGSTIN: '', placeOfSupply: '', itemSummary: '', taxableAmount: '', gstRate: '', taxMode: '', cgstAmount: '', sgstAmount: '', igstAmount: '', totalAmount: '', paymentStatus: '', paymentMethod: '', notes: '', sourceOrderId: ''
    });
    const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => `"${String((row as Record<string, string | number>)[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadBlob(`swetas-studio-sales-register-${settings.financialYearLabel}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  };

  const downloadJson = () => {
    downloadBlob(
      `swetas-studio-accounts-${settings.financialYearLabel}.json`,
      new Blob([JSON.stringify({ settings, entries: exportRows, summary }, null, 2)], { type: 'application/json' })
    );
  };

  const downloadXlsx = () => {
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([
      {
        financialYear: settings.financialYearLabel,
        taxableSales: summary.taxable,
        cgstPayable: summary.cgst,
        sgstPayable: summary.sgst,
        igstPayable: summary.igst,
        grossSales: summary.total,
        realised: summary.paid,
        outstanding: summary.outstanding,
      },
    ]);
    const entriesSheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'GST Summary');
    XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Sales Register');
    XLSX.writeFile(workbook, `swetas-studio-accounts-${settings.financialYearLabel}.xlsx`);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text(`${settings.tradeName} · Accounts Suite`, 14, 16);
    doc.setFontSize(10);
    doc.text(`FY ${settings.financialYearLabel} | GSTIN ${settings.gstin || 'Pending setup'}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [[
        'Invoice', 'Date', 'Customer', 'Taxable', 'GST %', 'CGST', 'SGST', 'IGST', 'Total', 'Status'
      ]],
      body: entries.map((entry) => [
        entry.invoiceNumber,
        entry.invoiceDate,
        entry.customerName,
        entry.taxableAmount.toFixed(2),
        String(entry.gstRate),
        entry.cgstAmount.toFixed(2),
        entry.sgstAmount.toFixed(2),
        entry.igstAmount.toFixed(2),
        entry.totalAmount.toFixed(2),
        entry.paymentStatus,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26, 26, 26] },
    });
    doc.save(`swetas-studio-accounts-${settings.financialYearLabel}.pdf`);
  };

  const downloadTallyXml = () => {
    const vouchers = entries.map((entry) => {
      const taxLedger = entry.taxMode === 'inter_state' ? 'Output IGST' : 'Output CGST & SGST';
      const taxAmount = entry.taxMode === 'inter_state' ? entry.igstAmount : entry.cgstAmount + entry.sgstAmount;
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${entry.invoiceDate.replace(/-/g, '')}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(entry.invoiceNumber)}</VOUCHERNUMBER>
            <PARTYNAME>${escapeXml(entry.customerName)}</PARTYNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <BASICBASEPARTYNAME>${escapeXml(entry.customerName)}</BASICBASEPARTYNAME>
            <BASICBUYERNAME>${escapeXml(entry.customerName)}</BASICBUYERNAME>
            <BASICBUYERADDRESS>${escapeXml(entry.placeOfSupply)}</BASICBUYERADDRESS>
            <GSTREGISTRATIONTYPE>${entry.customerGstin ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>
            <PARTYGSTIN>${escapeXml(entry.customerGstin || '')}</PARTYGSTIN>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(entry.customerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${entry.totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${entry.taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${taxLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    downloadBlob(`swetas-studio-accounts-${settings.financialYearLabel}-tally.xml`, new Blob([xml], { type: 'application/xml' }));
  };

  if (!canAccessAccounts) return <AdminAccessNotice />;
  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic">Opening the accounts suite...</div>;

  return (
    <AdminShell
      title={<><span>Accounts & </span><span className="italic">GST Suite</span></>}
      subtitle="Daily-ready sales register, GST summaries, and accounting exports for Indian boutique operations"
      actions={
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={downloadPdf} className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black inline-flex items-center gap-2"><FileText size={14} />PDF</button>
          <button type="button" onClick={downloadXlsx} className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black inline-flex items-center gap-2"><FileSpreadsheet size={14} />Excel</button>
          <button type="button" onClick={downloadCsv} className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black inline-flex items-center gap-2"><Download size={14} />CSV</button>
          <button type="button" onClick={downloadTallyXml} className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black inline-flex items-center gap-2"><Landmark size={14} />Tally XML</button>
          <button type="button" onClick={downloadJson} className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black inline-flex items-center gap-2"><Calculator size={14} />JSON</button>
        </div>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm"><p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Taxable Sales</p><p className="font-serif text-3xl mt-3">{formatCurrency(summary.taxable)}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm"><p className="text-[10px] uppercase tracking-[0.3em] opacity-45">GST Payable</p><p className="font-serif text-3xl mt-3">{formatCurrency(summary.cgst + summary.sgst + summary.igst)}</p><p className="text-xs opacity-50 mt-2">CGST {formatCurrency(summary.cgst)} · SGST {formatCurrency(summary.sgst)} · IGST {formatCurrency(summary.igst)}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm"><p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Collections Realised</p><p className="font-serif text-3xl mt-3">{formatCurrency(summary.paid)}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm"><p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Outstanding</p><p className="font-serif text-3xl mt-3">{formatCurrency(summary.outstanding)}</p></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-8">
        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Accounting Profile</p>
            <h2 className="text-2xl font-serif mt-2">Business & GST setup</h2>
            <p className="text-sm opacity-60 mt-3">Use this as your day-one operational accounts register. GST treatment is configurable per invoice so your CA can align it with the exact garment classification and place of supply.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Legal Name</span><input value={settings.legalName} onChange={(e) => setSettings((current) => ({ ...current, legalName: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Trade Name</span><input value={settings.tradeName} onChange={(e) => setSettings((current) => ({ ...current, tradeName: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">GSTIN</span><input value={settings.gstin} onChange={(e) => setSettings((current) => ({ ...current, gstin: e.target.value.toUpperCase() }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">State Name</span><input value={settings.stateName} onChange={(e) => setSettings((current) => ({ ...current, stateName: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">State Code</span><input value={settings.stateCode} onChange={(e) => setSettings((current) => ({ ...current, stateCode: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">FY Label</span><input value={settings.financialYearLabel} onChange={(e) => setSettings((current) => ({ ...current, financialYearLabel: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Invoice Prefix</span><input value={settings.invoicePrefix} onChange={(e) => setSettings((current) => ({ ...current, invoicePrefix: e.target.value.toUpperCase() }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Next Invoice No.</span><input type="number" value={settings.nextInvoiceNumber} onChange={(e) => setSettings((current) => ({ ...current, nextInvoiceNumber: Number(e.target.value) }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Default GST %</span><select value={settings.defaultGstRate} onChange={(e) => setSettings((current) => ({ ...current, defaultGstRate: Number(e.target.value) as GSTRate }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value={0}>0%</option><option value={3}>3%</option><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option></select></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Default Tax Mode</span><select value={settings.defaultTaxMode} onChange={(e) => setSettings((current) => ({ ...current, defaultTaxMode: e.target.value as GSTTaxMode }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value="intra_state">Intra-state (CGST + SGST)</option><option value="inter_state">Inter-state (IGST)</option></select></label>
          </div>

          <button type="button" onClick={() => void saveSettings()} disabled={saving} className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold disabled:opacity-50"><ReceiptIndianRupee size={14} />Save GST Profile</button>
        </section>

        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Sales Register Entry</p>
            <h2 className="text-2xl font-serif mt-2">Create invoice / ledger entry</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2 md:col-span-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Prefill From Order</span><select value={entryForm.sourceOrderId} onChange={(e) => { setEntryForm((current) => ({ ...current, sourceOrderId: e.target.value })); useOrder(e.target.value); }} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value="">Select an order (optional)</option>{orders.map((order) => <option key={order.id} value={order.id}>{`#${order.id.slice(-6)} · ${formatCurrency(order.totalAmount)} · ${order.status}`}</option>)}</select></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Invoice No.</span><div className="w-full border border-black/10 px-4 py-3 bg-[#faf7f0] text-sm">{invoicePreview.invoiceNumber}</div></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Invoice Date</span><input type="date" value={entryForm.invoiceDate} onChange={(e) => setEntryForm((current) => ({ ...current, invoiceDate: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Customer Name</span><input value={entryForm.customerName} onChange={(e) => setEntryForm((current) => ({ ...current, customerName: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Customer Email</span><input value={entryForm.customerEmail} onChange={(e) => setEntryForm((current) => ({ ...current, customerEmail: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Customer GSTIN</span><input value={entryForm.customerGstin} onChange={(e) => setEntryForm((current) => ({ ...current, customerGstin: e.target.value.toUpperCase() }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Place Of Supply</span><input value={entryForm.placeOfSupply} onChange={(e) => setEntryForm((current) => ({ ...current, placeOfSupply: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Taxable Amount</span><input type="number" value={entryForm.taxableAmount} onChange={(e) => setEntryForm((current) => ({ ...current, taxableAmount: Number(e.target.value) }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">GST %</span><select value={entryForm.gstRate} onChange={(e) => setEntryForm((current) => ({ ...current, gstRate: Number(e.target.value) as GSTRate }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value={0}>0%</option><option value={3}>3%</option><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option></select></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Tax Mode</span><select value={entryForm.taxMode} onChange={(e) => setEntryForm((current) => ({ ...current, taxMode: e.target.value as GSTTaxMode }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value="intra_state">Intra-state (CGST + SGST)</option><option value="inter_state">Inter-state (IGST)</option></select></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Payment Status</span><select value={entryForm.paymentStatus} onChange={(e) => setEntryForm((current) => ({ ...current, paymentStatus: e.target.value as InvoicePaymentStatus }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
            <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Payment Method</span><input value={entryForm.paymentMethod} onChange={(e) => setEntryForm((current) => ({ ...current, paymentMethod: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2 md:col-span-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Item Summary</span><textarea value={entryForm.itemSummary} onChange={(e) => setEntryForm((current) => ({ ...current, itemSummary: e.target.value }))} className="w-full min-h-[110px] border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
            <label className="space-y-2 md:col-span-2"><span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Notes</span><textarea value={entryForm.notes} onChange={(e) => setEntryForm((current) => ({ ...current, notes: e.target.value }))} className="w-full min-h-[90px] border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" /></label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#faf7f0] rounded-2xl p-4">
            <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">CGST</p><p className="font-serif text-xl mt-2">{formatCurrency(invoicePreview.cgstAmount)}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">SGST</p><p className="font-serif text-xl mt-2">{formatCurrency(invoicePreview.sgstAmount)}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">IGST</p><p className="font-serif text-xl mt-2">{formatCurrency(invoicePreview.igstAmount)}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">Invoice Total</p><p className="font-serif text-xl mt-2">{formatCurrency(invoicePreview.totalAmount)}</p></div>
          </div>

          <button type="button" onClick={() => void saveEntry()} disabled={saving || !entryForm.customerName || !entryForm.itemSummary || !entryForm.taxableAmount} className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold disabled:opacity-50"><Plus size={14} />Add To Accounts Register</button>
        </section>
      </div>

      <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Sales Register</p>
            <h2 className="text-2xl font-serif mt-2">Invoice and GST ledger</h2>
          </div>
          <p className="text-sm opacity-55">Exports are designed for PDF, Excel, CSV, Tally XML, and generic JSON handoff into accountants’ tools.</p>
        </div>

        <div className="space-y-4 max-h-[900px] overflow-auto pr-1">
          {entries.map((entry) => (
            <article key={entry.id} className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr_auto] gap-4 border border-black/5 rounded-2xl p-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-xl">{entry.invoiceNumber}</h3>
                  <span className="text-[10px] uppercase tracking-[0.25em] border border-black/10 px-2 py-1">{entry.paymentStatus}</span>
                  <span className="text-[10px] uppercase tracking-[0.25em] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[#a17f1a]">{entry.taxMode === 'inter_state' ? 'IGST' : 'CGST + SGST'}</span>
                </div>
                <p className="text-sm opacity-70">{entry.customerName} · {entry.placeOfSupply} · {entry.invoiceDate}</p>
                <p className="text-sm opacity-60">{entry.itemSummary}</p>
                {entry.notes && <p className="text-sm opacity-50 italic">{entry.notes}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">Taxable</p><p className="font-serif text-lg mt-2">{formatCurrency(entry.taxableAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">Total</p><p className="font-serif text-lg mt-2">{formatCurrency(entry.totalAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">CGST</p><p className="mt-2">{formatCurrency(entry.cgstAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">SGST</p><p className="mt-2">{formatCurrency(entry.sgstAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">IGST</p><p className="mt-2">{formatCurrency(entry.igstAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.25em] opacity-45">GST %</p><p className="mt-2">{entry.gstRate}%</p></div>
              </div>
              <div className="flex lg:justify-end">
                <button type="button" onClick={() => void deleteEntry(entry.id)} className="border border-red-200 text-red-600 p-3 rounded-xl hover:bg-red-50 h-fit"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          {entries.length === 0 && <div className="py-24 text-center opacity-35 italic font-serif">No accounting entries yet. Create your first invoice and the GST register will start building from day one.</div>}
        </div>
      </section>
    </AdminShell>
  );
};

export default AdminAccounts;
