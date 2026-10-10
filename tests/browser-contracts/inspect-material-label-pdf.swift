import Foundation
import PDFKit
import AppKit
let url=URL(fileURLWithPath:CommandLine.arguments[1])
guard let doc=PDFDocument(url:url) else {fatalError("PDF不可读取")}
let text=(0..<doc.pageCount).compactMap{doc.page(at:$0)?.string}.joined(separator:"\n")
let compact=text.components(separatedBy:.whitespacesAndNewlines).joined()
let target=try String(contentsOfFile:CommandLine.arguments[2],encoding:.utf8).trimmingCharacters(in:.whitespacesAndNewlines).components(separatedBy:.whitespacesAndNewlines).joined()
let count=compact.components(separatedBy:target).count-1
let output=CommandLine.arguments[3]
for index in [0,doc.pageCount-1]{if let page=doc.page(at:index){let image=page.thumbnail(of:NSSize(width:900,height:1200),for:.mediaBox);if let data=image.tiffRepresentation,let bitmap=NSBitmapImageRep(data:data),let png=bitmap.representation(using:.png,properties:[:]){try png.write(to:URL(fileURLWithPath:output+"-page-\(index+1).png"))}}}
print(String(data:try JSONSerialization.data(withJSONObject:["file":url.path,"pages":doc.pageCount,"modelOccurrences":count,"textCharacters":text.count],options:[]),encoding:.utf8)!)
if count != 100 {exit(1)}
