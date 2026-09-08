#!/usr/bin/env python3
"""
Скрипт для конвертации PDF файла в JSON формат listening тестов
"""

import pdfplumber
import json
import re
import sys
from typing import List, Dict, Any, Optional

class PDFToListeningConverter:
    def __init__(self):
        self.current_question_id = 0
        self.sections = []
        self.current_section = None
        
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Извлекает текст из PDF файла"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text
        except Exception as e:
            print(f"Ошибка при чтении PDF: {e}")
            return ""
    
    def identify_question_type(self, text: str) -> str:
        """Определяет тип вопроса на основе текста"""
        text_lower = text.lower()
        
        # Gap-fill вопросы (с пропусками)
        if "_____" in text or "___" in text or "..." in text:
            return "gap-fill"
        
        # Multiple choice вопросы
        if re.search(r'[A-D]\)', text) or re.search(r'[A-E]\)', text):
            return "multiple-choice"
        
        # Matching вопросы
        if "match" in text_lower or "matching" in text_lower:
            return "matching"
        
        # Multi-select вопросы
        if "choose two" in text_lower or "choose three" in text_lower:
            return "multi-select"
        
        # Table вопросы
        if "table" in text_lower or "complete the table" in text_lower:
            return "table"
        
        return "text"
    
    def parse_gap_fill_question(self, text: str, question_id: str) -> Dict[str, Any]:
        """Парсит gap-fill вопрос"""
        # Ищем пропуски в тексте
        gap_pattern = r'(_+|\u2026+)'
        matches = list(re.finditer(gap_pattern, text))
        
        if not matches:
            return {
                "type": "text",
                "value": text
            }
        
        # Разделяем текст на части
        parts = re.split(gap_pattern, text)
        result = []
        
        for i, part in enumerate(parts):
            if part and not re.match(r'^_+$', part):
                if i == 0:
                    result.append({
                        "type": "text",
                        "value": part
                    })
                else:
                    result.append({
                        "type": "question",
                        "questionId": question_id,
                        "format": "gap-fill",
                        "text": part,
                        "postfix": "",
                        "correctAnswer": "",  # Нужно будет заполнить вручную
                        "wordLimit": 1
                    })
        
        return result
    
    def parse_multiple_choice_question(self, text: str, question_id: str) -> Dict[str, Any]:
        """Парсит multiple choice вопрос"""
        # Ищем варианты ответов
        options_pattern = r'([A-E])\)\s*([^\n]+)'
        options = {}
        
        for match in re.finditer(options_pattern, text):
            letter = match.group(1)
            option_text = match.group(2).strip()
            options[letter] = option_text
        
        # Извлекаем основной текст вопроса
        question_text = re.sub(r'[A-E]\)[^\n]+', '', text).strip()
        question_text = re.sub(r'\n+', ' ', question_text)
        
        return {
            "type": "question",
            "questionId": question_id,
            "format": "multiple-choice",
            "text": question_text,
            "options": options,
            "correctAnswer": ""  # Нужно будет заполнить вручную
        }
    
    def parse_section(self, section_text: str, section_number: int) -> Dict[str, Any]:
        """Парсит секцию теста"""
        lines = section_text.strip().split('\n')
        content = []
        
        # Ищем заголовок секции
        title = ""
        for line in lines[:3]:  # Проверяем первые 3 строки
            if line.strip() and not re.match(r'^\d+\.', line):
                title = line.strip()
                break
        
        # Парсим содержимое
        current_question_group = None
        question_counter = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Определяем тип строки
            question_type = self.identify_question_type(line)
            
            if question_type == "gap-fill":
                question_counter += 1
                question_id = f"q{question_counter}"
                
                gap_fill_result = self.parse_gap_fill_question(line, question_id)
                if isinstance(gap_fill_result, list):
                    content.extend(gap_fill_result)
                else:
                    content.append(gap_fill_result)
                    
            elif question_type == "multiple-choice":
                question_counter += 1
                question_id = f"q{question_counter}"
                content.append(self.parse_multiple_choice_question(line, question_id))
                
            elif question_type == "text":
                content.append({
                    "type": "text",
                    "value": line
                })
        
        return {
            "sectionNumber": section_number,
            "title": title or f"Section {section_number}",
            "audioUrl": "",  # Нужно будет заполнить вручную
            "content": content,
            "instructions": {
                "heading": f"Questions {question_counter - len([c for c in content if c.get('type') == 'text']) + 1}-{question_counter}",
                "details": "Complete the notes below.",
                "note": "Write ONE WORD AND/OR A NUMBER for each answer."
            }
        }
    
    def convert_pdf_to_json(self, pdf_path: str, output_path: str = None) -> Dict[str, Any]:
        """Конвертирует PDF в JSON формат listening теста"""
        print(f"Извлекаем текст из PDF: {pdf_path}")
        text = self.extract_text_from_pdf(pdf_path)
        
        if not text:
            print("Не удалось извлечь текст из PDF")
            return {}
        
        print("Парсим содержимое...")
        
        # Разделяем текст на секции (примерно по 10 вопросов)
        sections = []
        lines = text.split('\n')
        current_section = []
        question_count = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Если это новый раздел или мы набрали достаточно вопросов
            if (re.match(r'^Section \d+', line) or 
                re.match(r'^Part \d+', line) or 
                question_count >= 10):
                
                if current_section:
                    section_text = '\n'.join(current_section)
                    section = self.parse_section(section_text, len(sections) + 1)
                    sections.append(section)
                    current_section = []
                    question_count = 0
            
            current_section.append(line)
            
            # Считаем вопросы
            if self.identify_question_type(line) in ["gap-fill", "multiple-choice"]:
                question_count += 1
        
        # Добавляем последнюю секцию
        if current_section:
            section_text = '\n'.join(current_section)
            section = self.parse_section(section_text, len(sections) + 1)
            sections.append(section)
        
        # Создаем JSON структуру
        result = {
            "title": f"IELTS Listening Test {len(sections)}",
            "parts": {
                "testId": f"ielts-listening-{len(sections)}",
                "title": f"IELTS Listening Practice Test {len(sections)}",
                "sections": sections,
                "metadata": {
                    "totalQuestions": sum(len([c for c in s["content"] if c.get("type") == "question"]) for s in sections),
                    "timeLimit": 30,
                    "version": "1.0",
                    "createdAt": "2024-01-15"
                }
            },
            "createdAt": {
                "_seconds": 1753610715,
                "_nanoseconds": 607000000
            }
        }
        
        # Сохраняем результат
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"JSON файл сохранен: {output_path}")
        
        return result

def main():
    if len(sys.argv) < 2:
        print("Использование: python pdf_to_listening_json.py <путь_к_pdf> [путь_к_выходному_json]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    converter = PDFToListeningConverter()
    result = converter.convert_pdf_to_json(pdf_path, output_path)
    
    if result:
        print("Конвертация завершена успешно!")
        print(f"Создано секций: {len(result['parts']['sections'])}")
        print(f"Всего вопросов: {result['parts']['metadata']['totalQuestions']}")
    else:
        print("Ошибка при конвертации")

if __name__ == "__main__":
    main()