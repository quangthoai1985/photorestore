Để tích hợp tính năng Image-to-Image của các model dòng gemini-3-pro-image-preview hoặc gemini-3.1-flash-image-preview vào môi trường bên ngoài (như React/Vite) thông qua API của Google AI Studio (Gemini API), bạn bắt buộc phải tuân thủ một số quy tắc kỹ thuật nghiêm ngặt để có kết quả chính xác như trên giao diện Web[1][2].

Dưới đây là hướng dẫn chi tiết cách viết code và tinh chỉnh các thông số.

1. Các Quy Tắc Kỹ Thuật Bắt Buộc (Best Practices & Constraints)

Dựa trên tài liệu chính thức của Google, khi làm việc với tính năng Image-to-Image bằng API:

Thứ tự trong mảng parts (Quan trọng nhất): Giống như cách AI Studio hoạt động, mảng parts của bạn phải đặt Hình ảnh ở index 0 và Text (Prompt) ở index 1. Điều này giúp model đọc được "trạng thái" (thought signatures) của bức ảnh gốc trước khi áp dụng câu lệnh chỉnh sửa[2][3].

Sử dụng Base64 (inlineData) thay vì File API: Theo cập nhật mới nhất từ Google, đối với tác vụ Image-to-Image (chỉnh sửa ảnh), việc truyền ảnh dạng Base64 (inlineData) hoạt động ổn định nhất[1][2]. Nếu bạn dùng File API (fileUri), API có thể bị lỗi ngầm và chỉ trả về Text thay vì Image[2].

Khai báo responseModalities: Bắt buộc phải khai báo rõ trong cấu hình rằng bạn muốn model trả về Ảnh ("IMAGE")[4][5].

2. Cấu Trúc Code Chuẩn (React / Vite)

Trong môi trường React/Vite, bạn có thể gọi trực tiếp REST API bằng fetch. Bạn cần chuyển đổi file ảnh do người dùng upload thành chuỗi Base64 (bỏ đi phần tiền tố data:image/jpeg;base64, trước khi gửi).

Dưới đây là đoạn code mẫu chuẩn xác nhất:

code
JavaScript
download
content_copy
expand_less
// Hàm chuyển file ảnh sang Base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Chỉ lấy data thô, cắt bỏ phần prefix "data:image/jpeg;base64,"
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

// Hàm gọi Gemini API (Image to Image)
const generateImageToImage = async (imageFile, promptText) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
  // Model bạn muốn dùng: gemini-3.1-flash-image-preview HOẶC gemini-3-pro-image-preview
  const model = "gemini-3.1-flash-image-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const base64Data = await fileToBase64(imageFile);
    const mimeType = imageFile.type; // vd: "image/jpeg" hoặc "image/png"

    const payload = {
      contents: [
        {
          role: "user",
          parts:[
            // QUY TẮC 1: HÌNH ẢNH LUÔN NẰM TRƯỚC (Base64)
            { 
              inlineData: { 
                mimeType: mimeType, 
                data: base64Data 
              } 
            },
            // QUY TẮC 2: TEXT PROMPT NẰM SAU
            { 
              text: promptText 
            }
          ]
        }
      ],
      // CẤU HÌNH CÁC THÔNG SỐ TINH CHỈNH (Aspect Ratio, Resolution, v.v.)
      generationConfig: {
        // Bắt buộc yêu cầu trả về Hình ảnh
        responseModalities: ["IMAGE", "TEXT"], 
        
        // --- Tinh chỉnh thông số (Tuỳ chọn) ---
        // Tuỳ thuộc vào API Payload mới nhất, các thông số ảnh thường nằm ở đây
        // hoặc được bao bọc trong thuộc tính `imageConfig`
        imageConfig: {
            aspectRatio: "16:9",      // Tỷ lệ khung hình (1:1, 16:9, 9:16, 4:3, v.v.)
            imageSize: "2K",          // Độ phân giải xuất: "0.5K", "1K" (mặc định), "2K", "4K"
            numberOfImages: 1         // Số lượng ảnh muốn xuất (Mặc định 1)
        },
        
        // Tinh chỉnh "Thinking Level" (Tuỳ model)
        thinkingConfig: {
            thinking: true            // Kích hoạt chuỗi suy luận (Thought process) cho các yêu cầu phức tạp
        }
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // Đọc kết quả Base64 trả về
    // Mảng parts của model trả về sẽ chứa inlineData chứa ảnh mới
    const returnedImageBase64 = data.candidates[0].content.parts.find(p => p.inlineData)?.inlineData.data;
    const returnedText = data.candidates[0].content.parts.find(p => p.text)?.text;

    return {
       image: `data:image/jpeg;base64,${returnedImageBase64}`,
       text: returnedText
    };

  } catch (error) {
    console.error("Lỗi khi xử lý Image-to-Image:", error);
  }
};
3. Giải thích các Thông Số Tinh Chỉnh (Generation Configs)

Trên Google AI Studio, góc bên phải của bạn chứa các Control Panel. Trong Code, bạn đưa chúng vào bên trong generationConfig (hoặc generationConfig.imageConfig tuỳ phiên bản REST API / SDK cụ thể)[6][7]:

aspectRatio (Tỷ lệ khung hình):
Gemini 3 Image Models hỗ trợ đa dạng tỷ lệ[5][7]. Bạn có thể truyền vào chuỗi String như: "1:1" (vuông), "16:9" (ngang chuẩn), "9:16" (dọc cho TikTok/Shorts), "4:3", "3:4", hoặc các tỷ lệ siêu rộng (panoramic) như "1:4", "4:1", "1:8", "8:1".

imageSize / outputResolution (Độ phân giải):
Bạn cấu hình chất lượng xuất ảnh tại đây[7].

"0.5K" (nhanh, 512x512)

"1K" (tiêu chuẩn mặc định, 1024x1024)

"2K" (2048x2048)

"4K" (4096x4096 - thường yêu cầu Model Pro để cho chi tiết tốt nhất).

thinkingConfig (Think Level / Khả năng suy luận):
Các dòng Gemini 3 (đặc biệt là Pro) được trang bị tính năng "Thinking"[8]. Model sẽ tự sinh ra các bản phác thảo tạm (thought images) trong nội bộ để căn chỉnh hình ảnh trước khi render thành phẩm cuối cùng[5]. Để kích hoạt, bạn truyền thinkingConfig: { thinking: true } vào trong generationConfig.
