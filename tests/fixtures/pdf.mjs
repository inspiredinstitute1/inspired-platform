// A small valid blank-page PDF generated entirely from synthetic ASCII objects.
export function syntheticPdf(){
 let pdf='%PDF-1.4\n';const offsets=[0];
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> >>'];
 for(const [index,object] of objects.entries()){offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;}
 const xref=pdf.length;pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');pdf+=`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(pdf);
}
