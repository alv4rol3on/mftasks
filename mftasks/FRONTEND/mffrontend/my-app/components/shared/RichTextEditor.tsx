
"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { apiFetch } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/richText";
import styles from "./RichTextEditor.module.css";

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const EXTENSIONES_IMAGEN = ["png", "jpg", "jpeg", "gif", "webp"];

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Detalla la solicitud",
  disabled = false,
}: Props) {
  const inputImagenRef = useRef<HTMLInputElement | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,

    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),

      Underline,

      Image.configure({
        inline: false,
        allowBase64: false,
      }),

      Placeholder.configure({
        placeholder,
      }),
    ],

    content: value || "",

    editorProps: {
      attributes: {
        class: styles.editorContent,
      },

      // Pegar únicamente texto plano o imágenes.
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;

        if (!clipboard) return false;

        // Detectar imágenes copiadas.
        const imagen = Array.from(clipboard.files).find(
          (file) => file.type.startsWith("image/")
        );

        if (imagen) {
          event.preventDefault();
          void subirImagen(imagen);
          return true;
        }

        // Ignorar HTML, código y formatos externos.
        const texto = clipboard.getData("text/plain");

        if (!texto) {
          event.preventDefault();
          return true;
        }

        event.preventDefault();
        view.pasteText(texto);

        return true;
      },
    },

    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? "" : current.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;

    const actual = editor.getHTML();
    const nuevo = value || "";

    if (actual === nuevo) return;
    if (editor.isEmpty && !nuevo) return;

    editor.commands.setContent(nuevo, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className={styles.loading}>Cargando editor…</div>;
  }

  // Subir imagen al servidor.
  const subirImagen = async (file: File | undefined) => {
    if (!file) return;

    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase() ?? ""
      : "";

    if (!EXTENSIONES_IMAGEN.includes(extension)) {
      setError("Solo se permiten imágenes PNG, JPG, JPEG, GIF o WEBP.");
      return;
    }

    if (file.size > MAX_IMAGEN_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      return;
    }

    setError(null);
    setSubiendoImagen(true);

    try {
      const formData = new FormData();
      formData.append("imagen", file, file.name);

      const res = await apiFetch<{ url: string }>(
        "/api/tasks/tasks/imagenes/",
        {
          method: "POST",
          body: formData,
        }
      );

      const src = resolveMediaUrl(res.url);

      if (!src) {
        throw new Error("No se recibió la URL de la imagen.");
      }

      editor
        .chain()
        .focus()
        .setImage({
          src,
          alt: file.name,
          title: file.name,
        })
        .run();

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendoImagen(false);
    }
  };

  const activo = (nombre: string) =>
    editor.isActive(nombre) ? styles.toolActive : "";

  return (
    <div className={`${styles.wrapper} ${disabled ? styles.disabled : ""}`}>

      {/* Barra de herramientas */}
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Formato de la descripción"
      >

        {/* Formato de texto */}
        <button
          type="button"
          className={`${styles.tool} ${activo("bold")}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          title="Negrita"
        >
          B
        </button>

        <button
          type="button"
          className={`${styles.tool} ${activo("italic")}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          title="Cursiva"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={`${styles.tool} ${activo("underline")}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          title="Subrayado"
        >
          <u>U</u>
        </button>

        <button
          type="button"
          className={`${styles.tool} ${activo("strike")}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          title="Tachado"
        >
          <s>S</s>
        </button>

        <span className={styles.separator} />

        {/* Listas */}
        <button
          type="button"
          className={`${styles.tool} ${activo("bulletList")}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          title="Lista con viñetas"
        >
          Lista
        </button>

        <button
          type="button"
          className={`${styles.tool} ${activo("orderedList")}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          title="Lista numerada"
        >
          1. Lista
        </button>

        <span className={styles.separator} />

        {/* Imágenes */}
        <button
          type="button"
          className={styles.tool}
          onClick={() => inputImagenRef.current?.click()}
          disabled={disabled || subiendoImagen}
          title="Insertar imagen"
        >
          {subiendoImagen ? "Subiendo…" : "Imagen"}
        </button>

        <span className={styles.separator} />

        {/* Deshacer y rehacer */}
        <button
          type="button"
          className={styles.tool}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={
            disabled ||
            !editor.can().chain().focus().undo().run()
          }
          title="Deshacer"
        >
          ↶
        </button>

        <button
          type="button"
          className={styles.tool}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={
            disabled ||
            !editor.can().chain().focus().redo().run()
          }
          title="Rehacer"
        >
          ↷
        </button>

        {/* Limpiar */}
        <button
          type="button"
          className={styles.tool}
          onClick={() => editor.chain().focus().clearContent().run()}
          disabled={disabled}
          title="Limpiar contenido"
        >
          Limpiar
        </button>

        {/* Input oculto para imágenes */}
        <input
          ref={inputImagenRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className={styles.hiddenInput}
          onChange={(e) => {
            const file = e.target.files?.[0];

            e.currentTarget.value = "";

            void subirImagen(file);
          }}
        />

      </div>

      {/* Área de edición */}
      <EditorContent editor={editor} />

      {/* Mensajes de error */}
      {error && (
        <p className={styles.error}>
          {error}
        </p>
      )}

    </div>
  );
}
