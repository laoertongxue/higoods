'use strict';
// V15 Indonesian display strings. Business identifiers and form values stay unchanged.
(()=>{
let lang=new URL(location.href).searchParams.get('lang')==='id'?'id':'zh';
const words={
'填写大于 0 的整数，空白不算 0。':'Isi bilangan bulat lebih dari 0. Kolom kosong bukan nol.','填写非负整数，空白不算 0。':'Isi bilangan bulat 0 atau lebih. Kolom kosong bukan nol.','填写大于 0 的数量，最多 3 位小数，空白不算 0。':'Isi jumlah lebih dari 0, maksimal 3 desimal. Kolom kosong bukan nol.','接收':'Terima','执行':'Proses','仓管':'Gudang','加工':'Kerjakan','交出':'Serahkan','实收':'Diterima','识别':'Baca kode','关闭':'Tutup','返回':'Kembali','继续填写':'Lanjut isi','选择填写':'Pilih isian','放弃':'Buang','继续保留':'Simpan sementara','放弃这笔填写':'Buang isian ini','选择未提交填写':'Pilih isian tertunda','交接设备前处理填写':'Sebelum serah perangkat','返回继续填写':'Lanjut isi','单据 / 操作':'Order / tindakan','工序':'Proses','当前身份只可查看':'Hanya lihat','当前身份只可查看此工序':'Proses ini hanya dapat dilihat','操作交给本工序对应岗位。':'Serahkan ke petugas proses ini.',
'以下内容尚未提交，不会交给下一位员工。':'Isian ini belum dikirim. Petugas berikutnya tidak akan mewarisinya.',
'只清除这笔未提交填写。其他单据及已登记数量保留。':'Hanya isian ini yang dibuang. Order lain dan jumlah tercatat tetap ada.',
'未找到本工序实物，核对工序和编号。':'Kode tidak ditemukan. Periksa proses dan pindai ulang.',
'该编号关联多单，选择明确加工单再操作。':'Ada beberapa order. Pilih order yang sesuai.',
'来货码不属于当前工序 / 本厂。':'Kode tidak sesuai proses atau pabrik ini.',
'本卷已核对，不重复计数。':'Rol ini sudah dipindai. Tidak dihitung dua kali.',
'卷码不在本次交出范围，旧卷码不能代替重包码。':'Kode rol tidak sesuai pengiriman ini. Pindai kode kemasan baru.',
'未保存，填写已保留。恢复后重试。':'Belum tersimpan. Isian tetap ada. Coba lagi setelah pulih.',
'未保存，原数量不变，填写已保留。':'Belum tersimpan. Jumlah lama tetap, isian tetap ada.',
'记录已变化，本次未保存；重新读取后核对原输入。':'Data berubah. Belum tersimpan. Muat ulang dan periksa isian.',
'重新读取并核对':'Muat ulang dan periksa','填写大于 0 的实际数量，最多两位小数。':'Isi jumlah lebih dari 0, maksimal 2 angka desimal.',
'先扫描或输入实际编号。':'Pindai atau ketik kode barang.','扫实物或输入编号。':'Pindai atau ketik kode barang.',
'扫码，或输编号回车':'Pindai / ketik kode, lalu Enter','扫本工序实物 / 单号':'Pindai barang / order','扫实物 / 输入编号':'Pindai / ketik kode','扫实物 / 输编号':'Pindai / ketik kode','扫本单菲票、批次或包码':'Kode tiket, batch, atau kemasan','扫描 / 输入编号':'Pindai / ketik kode','完整单号':'Nomor lengkap','完整辅料调拨单号':'Nomor transfer aksesori',
'核对编号':'Periksa kode','本次实收':'Jumlah diterima','本卷实收':'Jumlah rol diterima','本次实收面料':'Kain diterima kali ini','差异原因':'Alasan selisih','现场说明':'Catatan lapangan','实际放在哪里':'Lokasi barang','数量不符':'Jumlah berbeda','分批或短收说明':'Catatan penerimaan parsial','规格应收 / 已收':'Seharusnya / sudah diterima','交来方':'Dari','接收方':'Penerima','交到':'Tujuan','来自':'Dari','交给':'Kepada','交出人':'Penyerah','本次最多可交':'Maksimum diserahkan','本次实际交出':'Jumlah diserahkan','确认本卷实收':'Konfirmasi penerimaan rol','确认本次实收':'Konfirmasi penerimaan','确认实收':'Konfirmasi penerimaan','确认差异并实收':'Terima dengan selisih','确认交出':'Konfirmasi penyerahan','按剩余全部交出':'Serahkan seluruh sisa','回本单加工':'Lanjut kerjakan order','本次捆条产出':'Hasil potong bis','记录本次捆条产出':'Catat hasil bis','累计完成':'Total selesai','记录累计完成':'Catat total selesai','投入已收面料':'Proses kain diterima','计划 / 已投入':'Rencana / masuk proses','累计完成 / 已交':'Total selesai / diserahkan','规格计划 / 已完成':'Rencana / selesai','本次最多可做':'Maksimum dikerjakan','已收原料':'Bahan diterima','继续本规格加工':'Kerjakan spesifikasi ini','接收本规格原料':'Terima bahan spesifikasi ini','接收原料':'Terima bahan','交出本单产出':'Serahkan hasil order','本单操作记录':'Riwayat order','本单尚无交出。':'Belum ada penyerahan.','尚无已提交操作':'Belum ada tindakan tercatat','本卷已收':'Rol sudah diterima','本规格原料已收齐':'Bahan spesifikasi lengkap','交出与实收':'Penyerahan / penerimaan','逐次实收与责任':'Penerimaan dan petugas','我方交出':'Diserahkan','对方实收':'Diterima tujuan','待点收':'Menunggu hitung','已收齐':'Lengkap','原交出':'Referensi penyerahan','应收':'Seharusnya diterima','本次接收责任':'Tanggung jawab penerimaan','接收下一卷':'Terima rol berikutnya','继续本单加工':'Kerjakan order ini','回到本单':'Kembali ke order','本次加工':'Pengerjaan kali ini','原料接收':'Terima bahan','来货实收':'Terima barang','加工接收':'Ambil untuk proses','完工入仓':'Simpan hasil','库存与位置':'Stok / lokasi','未交出':'Belum diserahkan','待加工仓':'Gudang sebelum proses','待交出仓':'Gudang sebelum serah','处理中':'Dikerjakan','本厂仓管':'Petugas gudang','仓管':'Gudang','执行员':'Operator','交接员':'Petugas serah','本工序执行员':'Operator proses','其他岗位':'Pos lain','其他员工':'Petugas lain','横机执行':'Operator rajut','缝盘执行':'Operator linking','裁床仓管':'Gudang potong','裁剪执行':'Operator potong','后道处理员':'Petugas finishing','复核员':'Pemeriksa','成衣仓收货员':'Penerima gudang pakaian','本单作业':'Order ini','捆条加工':'Potong bis','水溶加工':'Proses larut air','无扫码设备？选择本批':'Tanpa pemindai? Pilih batch','无扫码设备？选择本单':'Tanpa pemindai? Pilih order','返回接收':'Kembali ke penerimaan','返回执行':'Kembali ke proses','返回仓管':'Kembali ke gudang',
'毛织':'Rajut','缝盘':'Linking','裁剪':'Potong','后整':'Finishing','染色':'Pewarnaan','印花':'Cetak kain','洗水':'Pencucian','水溶':'Larut air','捆条':'Potong bis','绣花':'Bordir','打条':'Jahit strip','压褶':'Pres lipit','打揽':'Smocking','烫画':'Transfer panas','直喷':'Cetak langsung','缝边绣':'Bordir tepi','盘扣':'Kancing simpul','布包扣':'Kancing bungkus','花朵':'Bunga kain','打褶':'Lipit','烫钻':'Pasang rhinestone','模板工序':'Jahit pola','激光开袋':'Potong saku laser','特种车缝（花样机）':'Jahit pola khusus','橡筋定长切割':'Potong elastik','织带／绳子半成品加工':'Buat pita / tali','织带／绳子截断':'Potong pita / tali','织带／绳子打头':'Ujung pita / tali','花边生产':'Buat renda'
};
Object.assign(words,window.pdaIndonesianTerms||{}, {
'继续保留':'Jangan buang','对方实收':'Diterima penerima','交接设备前处理填写':'Periksa isian sebelum serahkan PDA','完工入仓':'Masukkan hasil ke gudang','模板工序':'Proses dengan mal','仓管':'Gudang','放弃':'Buang isian'
});
const originalWords=Object.keys(words).sort((a,b)=>b.length-a.length);
const escRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phraseRx=new RegExp(originalWords.map(escRx).join('|'),'g');
const originals=new WeakMap();
const translate=raw=>{
 const v=raw.trim();if(words[v])return raw.replace(v,words[v]);
 const whole=v.match(/^确认全部 ([0-9.]+) 个已入库$/);if(whole)return 'Terima semua '+whole[1]+' buah';
 const actual=v.match(/^确认本次实收 ([0-9.]+) (.+)$/);if(actual)return 'Terima '+actual[1]+' '+translate(actual[2]);
 const layers=v.match(/^未分配的层数由 (.+) 完成。$/);if(layers)return 'Lapis sisanya dikerjakan oleh '+layers[1]+'.';
 const qc=v.match(/^将本批 ([0-9.]+) 件送检$/);if(qc)return 'Kirim '+qc[1]+' pcs ke inspeksi';
 const cycle=v.match(/^第 (\d+) 轮$/);if(cycle)return 'Siklus ke-'+cycle[1];
 const actor=v.match(/^[由须](.+)确认 · (.+)$/);if(actor)return 'Konfirmasi oleh '+(actor[1]==='仓管'?'petugas gudang':translate(actor[1]))+' · '+translate(actor[2]);
 if(/^本人未提交 · \d+ 笔$/.test(v))return 'Isian saya · '+v.match(/\d+/)[0];
 if(/^放弃这 \d+ 笔填写并交接$/.test(v))return 'Buang '+v.match(/\d+/)[0]+' isian lalu serahkan PDA';
 return raw.replace(phraseRx,m=>' '+words[m]+' ').replace(/ +/g,' ').replace(/\s*([，。；：！？、])/g,(_,p)=>({'，':', ','。':'. ','；':'; ','：':': ','！':'! ','？':'? ','、':', '}[p])).replace(/（/g,'(').replace(/）/g,')').trim();
};
window.pdaTranslate=translate;

function apply(){document.querySelector('.device')?.setAttribute('lang',lang==='id'?'id':'zh-CN');document.body.classList.toggle('pda-id',lang==='id');
 for(const root of [document.getElementById('app'),document.getElementById('overlay')]){if(!root)continue;const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){if(n.parentElement.closest('script,style,textarea,[translate=no]'))continue;const old=originals.get(n);if(!old||n.nodeValue!==old.result)originals.set(n,{source:n.nodeValue,result:n.nodeValue});const item=originals.get(n),text=lang==='id'?(item.source.trim()==='仓管'&&n.parentElement.closest('.wb-person,.asa-person,.cf-person,.kl-person,.dpw-person,.pf-role,.device-account-info')?'Petugas gudang':translate(item.source)):item.source;if(text!==n.nodeValue){n.nodeValue=text;item.result=text;}}
 for(const el of root.querySelectorAll('[placeholder],[aria-label],img[alt],[title]'))for(const key of ['placeholder','aria-label','alt','title'])if(el.hasAttribute(key)){const dataKey='original'+key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toUpperCase());const orig=el.dataset[dataKey]||el.getAttribute(key);el.dataset[dataKey]=orig;el.setAttribute(key,lang==='id'?translate(orig):orig);}}
 window.pdaUpdateSessionLanguage?.(lang);
 const u=new URL(location.href);if(lang==='id')u.searchParams.set('lang','id');else u.searchParams.delete('lang');history.replaceState({},'',u);
}
window.pdaGetLanguage=()=>lang;window.pdaSetLanguage=value=>{lang=value==='id'?'id':'zh';apply();};
window.pdaOriginalText=el=>{if(!el)return '';const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,s='';while(n=walk.nextNode())s+=originals.get(n)?.source||n.nodeValue;return s;};
const renderBefore=render;render=function(){renderBefore();apply();};
const observer=new MutationObserver(()=>{observer.disconnect();apply();observe();});function observe(){for(const id of ['app','overlay'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});}
$('.review-notes').insertAdjacentHTML('beforeend','<div class="note-box" id="locale-review"><b>语言版式预览 · 不属于 PDA</b><p>各工序操作、校验和异常文案的印尼语设计译稿。保留原编号和填写值；尚未进行现场母语验收。</p><button data-preview-lang="zh">中文</button><button data-preview-lang="id">Bahasa Indonesia</button><p>数量可填 1,5 或 1.5；不接受千分位。片 panel、件 pcs、条 potong、根 utas 分开显示；物理计量不换算。</p></div>');
window.addEventListener('click',e=>{const b=e.target.closest('[data-preview-lang]');if(!b)return;lang=b.dataset.previewLang;apply();});
apply();observe();
})();
