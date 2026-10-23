"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
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
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: styles.editorContent,
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

  const setLink = () => {
    const anterior = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "URL del enlace (vacío para quitarlo)",
      anterior || "https://"
    );

    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    if (!/^https?:\/\//i.test(url.trim()) && !url.trim().startsWith("mailto:")) {
      setError("El enlace debe comenzar con http://, https:// o mailto:.");
      return;
    }

    setError(null);
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  const agregarImagenPorUrl = () => {
    const url = window.prompt("URL de la imagen");

    if (!url) return;

    if (!/^https?:\/\//i.test(url.trim())) {
      setError("La imagen debe tener una URL http:// o https://.");
      return;
    }

    setError(null);
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

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

      const res = await apiFetch<{ url: string }>("/api/tasks/tasks/imagenes/", {
        method: "POST",
        body: formData,
      });

      const src = resolveMediaUrl(res.url);

      if (!src) {
        throw new Error("No se recibió la URL de la imagen.");
      }

      editor
        .chain()
        .focus()
        .setImage({ src, alt: file.name, title: file.name })
        .run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendoImagen(false);
    }
  };

  const activo = (nombre: string, atributos?: Record<string, unknown>) =>
    editor.isActive(nombre, atributos) ? styles.toolActive : "";

  return (
    <div className={`${styles.wrapper} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formato de la descripción">
        <button type="button" className={`${styles.tool} ${activo("bold")}`} onClick={() => editor.chain().focus().toggleBold().run()} disabled={disabled} title="Negrita">B</button>
        <button type="button" className={`${styles.tool} ${activo("italic")}`} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={disabled} title="Cursiva"><em>I</em></button>
        <button type="button" className={`${styles.tool} ${activo("underline")}`} onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={disabled} title="Subrayado"><u>U</u></button>
        <button type="button" className={`${styles.tool} ${activo("strike")}`} onClick={() => editor.chain().focus().toggleStrike().run()} disabled={disabled} title="Tachado"><s>S</s></button>

        <span className={styles.separator} />

        <button type="button" className={`${styles.tool} ${activo("heading", { level: 2 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={disabled} title="Título 2">H2</button>
        <button type="button" className={`${styles.tool} ${activo("heading", { level: 3 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} disabled={disabled} title="Título 3">H3</button>

        <span className={styles.separator} />

        <button type="button" className={`${styles.tool} ${activo("bulletList")}`} onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={disabled} title="Lista con viñetas">Lista</button>
        <button type="button" className={`${styles.tool} ${activo("orderedList")}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={disabled} title="Lista numerada">1. Lista</button>
        <button type="button" className={`${styles.tool} ${activo("blockquote")}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={disabled} title="Cita">Cita</button>
        <button type="button" className={`${styles.tool} ${activo("codeBlock")}`} onClick={() => editor.chain().focus().toggleCodeBlock().run()} disabled={disabled} title="Bloque de código">Código</button>

        <span className={styles.separator} />

        <button type="button" className={`${styles.tool} ${activo("link")}`} onClick={setLink} disabled={disabled} title="Insertar enlace">Enlace</button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => inputImagenRef.current?.click()}
          disabled={disabled || subiendoImagen}
          title="Subir imagen"
        >
          {subiendoImagen ? "Subiendo…" : "Imagen"}
        </button>
        <button type="button" className={styles.tool} onClick={agregarImagenPorUrl} disabled={disabled} title="Insertar imagen por URL">URL imagen</button>

        <span className={styles.separator} />

        <button type="button" className={styles.tool} onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().chain().focus().undo().run()} title="Deshacer">↶</button>
        <button type="button" className={styles.tool} onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().chain().focus().redo().run()} title="Rehacer">↷</button>
        <button type="button" className={styles.tool} onClick={() => editor.chain().focus().clearContent().run()} disabled={disabled} title="Limpiar contenido">Limpiar</button>

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

      <EditorContent editor={editor} />

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
