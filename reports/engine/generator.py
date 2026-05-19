from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
import os

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


async def generate_pdf(template_name: str, data: dict, output_path: str) -> str:
    template = env.get_template(f"{template_name}/index.html")
    html_content = template.render(**data)
    css_path = os.path.join(TEMPLATES_DIR, template_name, "style.css")
    stylesheets = [CSS(filename=css_path)] if os.path.exists(css_path) else []

    HTML(
        string=html_content,
        base_url=os.path.join(TEMPLATES_DIR, template_name),
    ).write_pdf(output_path, stylesheets=stylesheets)

    return output_path
