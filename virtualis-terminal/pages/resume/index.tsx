// cogitatio-virtualis/virtualis-terminal/pages/resume/index.tsx

import { useEffect } from 'react';

export default function PDFPage() {
  useEffect(() => {
    document.title = 'PDF Viewer - Cogitatio Virtualis';
  }, []);

  const printPDF = () => {
    window.print();
  };

  const closeWindow = () => {
    window.close();
  };

  return (
    <div className='pdf-container'>
      <div className='pdf-header'>
        <button onClick={printPDF} className='terminal-button'>
          [ Print ]
        </button>
        <button onClick={closeWindow} className='terminal-button'>
          [ Exit ]
        </button>
      </div>
      <embed src='/resume.pdf#toolbar=0&navpanes=0&scrollbar=0' type='application/pdf' className='pdf-viewer' />
    </div>
  );
}
