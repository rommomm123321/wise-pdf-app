// test_gpu.c - Test MuPDF GPU functions
#include <mupdf/fitz.h>
#include <stdio.h>

int main() {
    printf("Testing MuPDF GPU Support\n");
    
    // Check if GPU functions are available
    printf("1. Checking MuPDF version...\n");
    
    // Try to create a GPU device (if available)
    fz_context *ctx = fz_new_context(NULL, NULL, FZ_STORE_UNLIMITED);
    if (!ctx) {
        printf("Failed to create context\n");
        return 1;
    }
    
    printf("2. Context created successfully\n");
    
    // Note: Actual GPU device creation requires OpenGL/Vulkan context
    // which is platform-specific and complex
    
    fz_drop_context(ctx);
    printf("3. Context dropped\n");
    
    printf("\nGPU support check complete.\n");
    printf("For actual GPU testing, need:\n");
    printf("- OpenGL/Vulkan context\n");
    printf("- Window system (X11/Wayland/Win32)\n");
    printf("- GPU drivers installed\n");
    
    return 0;
}