'use strict';

// PXL-STG-0008 — aturan nomor invoice PPN / Non-PPN.
// Counter terpisah per series dan tahun, berlanjut antarbulan,
// reset ke 001 saat tahun berganti, minimum 3 digit.

const SERIES = Object.freeze({
  PPN: 'INVCK',
  NON_PPN: 'INVPIXEL'
});

function padSequence(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error('Urutan invoice harus bilangan bulat positif.');
  return String(n).padStart(3, '0');
}

function normalizeDate(input) {
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Tanggal invoice tidak valid.');
  return d;
}

function formatInvoiceNumber({ series, invoiceDate, sequence }) {
  if (!Object.values(SERIES).includes(series)) throw new Error('Series invoice tidak valid.');
  const d = normalizeDate(invoiceDate);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${series}-${month}${year}${padSequence(sequence)}`;
}

function parseInvoiceNumber(value) {
  const text = String(value || '').trim().toUpperCase();
  const match = /^(INVCK|INVPIXEL)-(0[1-9]|1[0-2])(\d{4})(\d{3,})$/.exec(text);
  if (!match) throw new Error('Format nomor invoice tidak valid.');
  return {
    invoiceNumber: text,
    series: match[1],
    month: Number(match[2]),
    year: Number(match[3]),
    sequence: Number(match[4])
  };
}

function validateManualNext({ manualNumber, expectedSeries, invoiceDate, lastSequence }) {
  const parsed = parseInvoiceNumber(manualNumber);
  const d = normalizeDate(invoiceDate);
  const expectedMonth = d.getMonth() + 1;
  const expectedYear = d.getFullYear();
  const expectedSequence = Number(lastSequence || 0) + 1;

  if (parsed.series !== expectedSeries) throw new Error('Prefix nomor manual tidak sesuai jenis invoice.');
  if (parsed.month !== expectedMonth || parsed.year !== expectedYear) {
    throw new Error('Bulan dan tahun nomor manual harus mengikuti tanggal invoice.');
  }
  if (parsed.sequence !== expectedSequence) {
    throw new Error(`Nomor manual harus menggunakan urutan berikutnya: ${padSequence(expectedSequence)}.`);
  }
  return parsed;
}

function seriesForTaxMode(taxMode) {
  return String(taxMode || '').toLowerCase() === 'non_ppn' ? SERIES.NON_PPN : SERIES.PPN;
}

module.exports = {
  SERIES,
  padSequence,
  formatInvoiceNumber,
  parseInvoiceNumber,
  validateManualNext,
  seriesForTaxMode
};
