"""
PDF Report Generator for Route Analysis

Generates professional PDF reports for route comparison after rerouting.
Uses fpdf2 library for PDF generation.
"""

import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from fpdf import FPDF

from ..utils.logger import get_logger

logger = get_logger("ml_module.utils.report_generator")


class RouteReportPDF(FPDF):
    """Custom PDF class for route reports with header/footer."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.set_auto_page_break(auto=True, margin=15)
    
    def header(self):
        """Add header to each page."""
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'QUANTARA - Route Analysis Report', align='C', new_x='LMARGIN', new_y='NEXT')
        self.set_draw_color(150, 200, 100)  # Lime green
        self.set_line_width(0.5)
        self.line(10, 20, 200, 20)
        self.ln(5)
    
    def footer(self):
        """Add footer to each page."""
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Generated on {datetime.now().strftime("%Y-%m-%d %H:%M")} | Page {self.page_no()}', align='C')


def generate_route_report(
    comparison_data: Dict[str, Any],
    original_route: Dict[str, Any],
    new_route: Dict[str, Any],
    output_dir: str = None
) -> str:
    """
    Generate a PDF report comparing original and rerouted routes.
    
    Args:
        comparison_data: Comparison report from Gemini (Task C output)
        original_route: Original route data from database
        new_route: New rerouted route data
        output_dir: Directory to save PDF (defaults to ml_module/reports)
    
    Returns:
        Path to generated PDF file
    """
    logger.info("Generating route comparison report...")
    
    # Set default output directory
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), "..", "reports")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Create PDF
    pdf = RouteReportPDF()
    pdf.add_page()
    
    # Title Section
    pdf.set_font('Helvetica', 'B', 20)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(0, 15, 'Route Rerouting Analysis', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(5)
    
    # Trip Summary
    _add_section_header(pdf, "TRIP SUMMARY")
    
    original_name = original_route.get("route_name", "Original Route")
    new_name = new_route.get("route_name", new_route.get("courier", {}).get("name", "New Route"))
    source = original_route.get("source", "Unknown")
    destination = original_route.get("destination", "Unknown")
    
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, f'Source: {source}', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 8, f'Destination: {destination}', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 8, f'Original Route: {original_name}', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 8, f'Rerouted To: {new_name}', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 8, f'Reroute Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(5)
    
    # Why Rerouting Occurred
    _add_section_header(pdf, "WHY REROUTING OCCURRED")
    
    # Get risk factors from original sentiment
    original_sentiment = original_route.get("sentiment_analysis", {})
    risk_factors = original_sentiment.get("risk_factors", [])
    
    if risk_factors:
        for factor in risk_factors:
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(180, 80, 80)  # Red for risks
            pdf.cell(0, 7, f'⚠ {factor}', new_x='LMARGIN', new_y='NEXT')
    else:
        pdf.set_font('Helvetica', 'I', 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 7, 'No specific risk factors identified', new_x='LMARGIN', new_y='NEXT')
    
    # Add reasoning from comparison
    if comparison_data:
        sentiment_change = comparison_data.get("sentiment_change", {})
        if sentiment_change.get("reason"):
            pdf.ln(3)
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(0, 6, f'Analysis: {sentiment_change.get("reason", "")}')
    pdf.ln(5)
    
    # Comparison Table
    _add_section_header(pdf, "COMPARISON METRICS")
    
    # Table header
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_text_color(50, 50, 50)
    
    col_widths = [50, 40, 40, 35, 25]
    headers = ['Factor', 'Original', 'After Reroute', 'Change', 'Better?']
    
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 8, header, border=1, align='C', fill=True)
    pdf.ln()
    
    # Table rows
    pdf.set_font('Helvetica', '', 10)
    
    # Get comparison metrics
    original_scores = original_route.get("resilience_scores", {})
    
    # Time comparison
    orig_time = original_route.get("time", new_route.get("time", "N/A"))
    new_time = new_route.get("time", "N/A")
    _add_table_row(pdf, col_widths, [
        "Time",
        str(orig_time),
        str(new_time),
        _calculate_change(orig_time, new_time),
        "→"
    ])
    
    # Distance comparison
    orig_dist = original_route.get("distance", new_route.get("distance", "N/A"))
    new_dist = new_route.get("distance", "N/A")
    _add_table_row(pdf, col_widths, [
        "Distance",
        str(orig_dist),
        str(new_dist),
        _calculate_change(orig_dist, new_dist),
        "→"
    ])
    
    # Cost comparison
    orig_cost = original_route.get("cost", new_route.get("cost", "N/A"))
    new_cost = new_route.get("cost", "N/A")
    _add_table_row(pdf, col_widths, [
        "Cost",
        str(orig_cost),
        str(new_cost),
        _calculate_change(orig_cost, new_cost),
        "→"
    ])
    
    # Carbon comparison
    orig_carbon = original_route.get("carbonEmission", new_route.get("carbonEmission", "N/A"))
    new_carbon = new_route.get("carbonEmission", "N/A")
    _add_table_row(pdf, col_widths, [
        "Carbon",
        str(orig_carbon),
        str(new_carbon),
        _calculate_change(orig_carbon, new_carbon),
        "→"
    ])
    
    # Sentiment comparison
    orig_sentiment_score = original_sentiment.get("sentiment_score", 0.5) * 100
    new_sentiment = new_route.get("news_sentiment_analysis", {})
    new_sentiment_score = new_sentiment.get("sentiment_score", 0.5) * 100
    sentiment_change_val = new_sentiment_score - orig_sentiment_score
    sentiment_better = "✓" if sentiment_change_val > 0 else ("✗" if sentiment_change_val < 0 else "→")
    
    _add_table_row(pdf, col_widths, [
        "Sentiment",
        f"{orig_sentiment_score:.0f}%",
        f"{new_sentiment_score:.0f}%",
        f"{'+' if sentiment_change_val > 0 else ''}{sentiment_change_val:.0f}%",
        sentiment_better
    ])
    
    pdf.ln(5)
    
    # Tradeoffs Section
    if comparison_data and comparison_data.get("tradeoffs"):
        _add_section_header(pdf, "TRADEOFF ANALYSIS")
        
        for tradeoff in comparison_data.get("tradeoffs", []):
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(60, 60, 60)
            pdf.cell(0, 7, f'{tradeoff.get("factor", "Factor")}:', new_x='LMARGIN', new_y='NEXT')
            
            pdf.set_font('Helvetica', '', 10)
            pdf.multi_cell(0, 6, f'  {tradeoff.get("assessment", "No assessment available")}')
            pdf.ln(2)
        pdf.ln(3)
    
    # Conclusion
    _add_section_header(pdf, "CONCLUSION")
    
    if comparison_data:
        summary = comparison_data.get("summary", "")
        recommendation = comparison_data.get("recommendation", "")
        
        if summary:
            pdf.set_font('Helvetica', '', 11)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(0, 6, summary)
            pdf.ln(3)
        
        if recommendation:
            pdf.set_font('Helvetica', 'B', 11)
            pdf.set_text_color(80, 150, 80)  # Green for recommendation
            pdf.multi_cell(0, 6, f'Recommendation: {recommendation}')
    else:
        pdf.set_font('Helvetica', '', 11)
        pdf.set_text_color(60, 60, 60)
        pdf.multi_cell(0, 6, 'Route was successfully rerouted to avoid identified risks. '
                             'The new route provides an alternative path to the destination.')
    
    # Save PDF
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"route_report_{timestamp}.pdf"
    filepath = os.path.join(output_dir, filename)
    
    pdf.output(filepath)
    logger.info(f"Report generated: {filepath}")
    
    return filepath


def _add_section_header(pdf: FPDF, title: str):
    """Add a styled section header."""
    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_text_color(100, 180, 100)  # Lime green
    pdf.cell(0, 10, title, new_x='LMARGIN', new_y='NEXT')
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)


def _add_table_row(pdf: FPDF, col_widths: List[int], values: List[str]):
    """Add a row to the comparison table."""
    pdf.set_text_color(60, 60, 60)
    for i, value in enumerate(values):
        pdf.cell(col_widths[i], 7, value, border=1, align='C')
    pdf.ln()


def _calculate_change(orig_val, new_val) -> str:
    """Calculate change between values (handles string formats)."""
    try:
        # Try to extract numbers
        if isinstance(orig_val, str) and isinstance(new_val, str):
            orig_num = float(''.join(filter(lambda x: x.isdigit() or x == '.', orig_val)))
            new_num = float(''.join(filter(lambda x: x.isdigit() or x == '.', new_val)))
            diff = new_num - orig_num
            if diff > 0:
                return f"+{diff:.0f}"
            elif diff < 0:
                return f"{diff:.0f}"
            else:
                return "0"
    except:
        pass
    return "N/A"
