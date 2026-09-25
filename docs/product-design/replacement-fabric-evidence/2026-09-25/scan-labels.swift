import Foundation
import Vision
import AppKit
var rows:[[String:Any]]=[]
for path in CommandLine.arguments.dropFirst() {
 guard let image=NSImage(contentsOfFile:path), let cg=image.cgImage(forProposedRect:nil,context:nil,hints:nil) else {fatalError("image unreadable")}
 let request=VNDetectBarcodesRequest();request.symbologies=[.qr]
 try VNImageRequestHandler(cgImage:cg).perform([request])
 let values=(request.results ?? []).compactMap{$0.payloadStringValue}
 if values.count != 1 {fatalError("expected one readable QR per label: \(path) -> \(values)")}
 rows.append(["file":path,"qr":values[0]])
}
let data=try JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys]);print(String(data:data,encoding:.utf8)!)
