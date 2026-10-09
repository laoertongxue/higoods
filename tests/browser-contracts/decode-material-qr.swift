import Foundation
import Vision
import AppKit
let path=CommandLine.arguments[1]
let url=URL(fileURLWithPath:path)
let request=VNDetectBarcodesRequest()
request.symbologies=[.qr]
try VNImageRequestHandler(url:url,options:[:]).perform([request])
let values=(request.results ?? []).compactMap{$0.payloadStringValue}
let data=try JSONSerialization.data(withJSONObject:values,options:[])
print(String(data:data,encoding:.utf8)!)
