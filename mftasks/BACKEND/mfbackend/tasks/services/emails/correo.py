#de prueba, perteneciente a otro proyecto
import pandas as pd
from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.styles import Font

from email.mime.base import MIMEBase
from email import encoders
import traceback

import os,glob
import shutil
import traceback
import time
import pandas  as pd

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from email.mime.base import MIMEBase
import io

class Class_Correo:

    def __init__(self,reci, cc):
        self.__Correo = MIMEMultipart('alternative')
        self.__Correo["Date"] = time.strftime("%a, %d %b %Y %H:%M:%S %z", time.localtime())
        self.__Correo['From'] = "LZ4lv4roJoaqu1n@outlook.com"
        self.recipients = reci
        self.cc_recipients = cc
        self.__Correo['To'] = ", ".join(reci)
        self.__Correo['Cc'] = ", ".join(cc)
       
        
    def __Enviar_Correo(self,email_subject):
        email_username = "LZ4lv4roJoaqu1n@outlook.com" 
        email_password = "Tag09219" 
        server = smtplib.SMTP("smtp-mail.outlook.com" , '587') 
        server.ehlo() 
        server.starttls() 
        server.login(email_username, email_password) 
        self.__Correo['Subject'] = email_subject 
        recipients = self.recipients.copy()  # Copia la lista de destinatarios
        recipients.extend(self.cc_recipients)  # Agrega los destinatarios de copia
        server.sendmail(self.__Correo["From"],recipients,self.__Correo.as_string()) 
        server.quit()
    
    def Enviar_Correo_Estado(self,Asunto):
        self.__Enviar_Correo(Asunto)
    
    def Adjuntar_Imagen(self,ruta_img,nombre_imagen):
        with open(ruta_img, 'rb') as f:
            img = MIMEImage(f.read())
            img.add_header('Content-Disposition', 'attachment', filename=ruta_img.split("\\")[-1])
            img.add_header('Content-ID', f'<{nombre_imagen}>')
            self.__Correo.attach(img)
           
    def Cuerpo_HTML(self, HTML):
        partHTML = MIMEText(HTML, "html")
        self.__Correo.attach(partHTML)
        
    def Adjuntar_Archivo(self, ruta_archivo, nombre_archivo,tipo):
        part = MIMEBase('application', "octet-stream")
        part.set_payload(open(ruta_archivo, "rb").read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f"attachment; filename={nombre_archivo}")
        self.__Correo.attach(part)
        
    def ajustar_ancho_columnas(self, worksheet):
        for columna in worksheet.columns:
            longitud_maxima = 0
            columna_letra = columna[0].column_letter
            for celda in columna:
                try:
                    if len(str(celda.value)) > longitud_maxima:
                        longitud_maxima = len(celda.value)
                except:
                    pass
            ajuste = (longitud_maxima + 2) * 1.2
            worksheet.column_dimensions[columna_letra].width = ajuste

    def guardar_dataframe_en_excel(self, dataframe, writer, sheet_name):
        dataframe.to_excel(writer, index=False, sheet_name=sheet_name)
        workbook = writer.book
        worksheet = writer.sheets[sheet_name]

        self.ajustar_ancho_columnas(worksheet)

        table = Table(displayName=sheet_name, ref=worksheet.dimensions)
        style = TableStyleInfo(
            name="TableStyleMedium7", showFirstColumn=False, showLastColumn=False,
            showRowStripes=True, showColumnStripes=False)
        table.tableStyleInfo = style
        worksheet.add_table(table)

        font = Font(color='FFFFFFFF')
        for cell in worksheet[1]:
            cell.font = font
    
    def enviar_dataframe(self, df, sheet_name="Hoja_1", nombre_archivo="dataframe"):
        excel_file = io.BytesIO()
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            self.guardar_dataframe_en_excel(df, writer, sheet_name)

        excel_file.seek(0)

        part = MIMEBase('application', "octet-stream")
        part.set_payload(excel_file.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition',
                        f"attachment; filename={nombre_archivo}.xlsx")

        self.__Correo.attach(part)
