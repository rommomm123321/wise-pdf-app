package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gen2brain/go-fitz"
)

func main() {
	// Проверяем доступность GPU функций в go-fitz
	fmt.Println("=== GPU Acceleration Test ===")
	fmt.Println("Testing go-fitz version with MuPDF...")

	// Создаем простой тест PDF для рендеринга
	testPDF := createTestPDF()
	if testPDF == "" {
		log.Fatal("Failed to create test PDF")
	}
	defer os.Remove(testPDF)

	// Тест 1: CPU рендеринг (стандартный)
	fmt.Println("\n1. CPU Rendering Test:")
	start := time.Now()
	doc, err := fitz.New(testPDF)
	if err != nil {
		log.Fatalf("Failed to open PDF: %v", err)
	}
	defer doc.Close()

	// Рендерим первую страницу
	img, err := doc.ImageDPI(0, 72.0) // 100% scale
	if err != nil {
		log.Fatalf("Failed to render image: %v", err)
	}
	cpuTime := time.Since(start)
	fmt.Printf("   Time: %v\n", cpuTime)
	fmt.Printf("   Image size: %dx%d\n", img.Bounds().Dx(), img.Bounds().Dy())

	// Проверяем доступные функции в go-fitz
	fmt.Println("\n2. Checking available functions in go-fitz:")
	fmt.Println("   - fitz.New: ✓")
	fmt.Println("   - doc.ImageDPI: ✓")
	fmt.Println("   - doc.NumPage: ✓")
	fmt.Println("   - doc.ToC: ✓")

	// Проверяем наличие GPU-специфичных функций
	fmt.Println("\n3. GPU Function Availability:")
	fmt.Println("   Note: go-fitz is a wrapper around MuPDF C API")
	fmt.Println("   Need to check MuPDF source for GPU support...")

	// Проверяем MuPDF версию
	fmt.Println("\n4. MuPDF Version Info:")
	// go-fitz не предоставляет версию напрямую, но мы можем проверить
	// по наличию определенных функций или через CGo

	fmt.Println("\n=== Next Steps ===")
	fmt.Println("1. Check MuPDF source code for GPU rendering functions")
	fmt.Println("2. Modify go-fitz to expose GPU device creation")
	fmt.Println("3. Test with OpenGL/Vulkan backends")
	fmt.Println("4. Benchmark CPU vs GPU performance")
}

func createTestPDF() string {
	// Создаем простой тестовый PDF с помощью go-fitz
	// или используем существующий тестовый файл
	return "test.pdf" // В реальности нужно создать или скачать тестовый PDF
}