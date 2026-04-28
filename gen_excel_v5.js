import XLSX from 'xlsx';
import fs from 'fs';

const data = [
  {
    application_id: 'APP59218',
    name: 'Shreya Iyer',
    contact: '7417417417',
    category: 'General',
    gender: 'Female',
    course: 'BSc (Computer Science)',
    amount: 10000,
    installment: 1
  }
];

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Scholarship Approval');

const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync('scholarship_general_v5.xlsx', buf);
console.log('✅ Standardized Excel file (v5) generated: scholarship_general_v5.xlsx');
