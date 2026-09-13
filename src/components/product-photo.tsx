"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, ImageOff, LoaderCircle, Trash2 } from "lucide-react";
import { preparePhoto } from "@/data/prepare-photo";
import { Button } from "./ui";

export function ProductPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? (
    <div className="photo-placeholder">
      <ImageOff size={27} />
      <span>Foto indisponível</span>
    </div>
  ) : (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 650px) 100vw, 400px"
      className="product-photo-image"
      onError={() => setFailed(src)}
      onLoad={() => setFailed(null)}
    />
  );
}

export function PhotoField({
  value,
  onChange,
  pending,
  onPending,
  disabled,
}: {
  value: string | null;
  onChange(value: string | null): void;
  pending: boolean;
  onPending(value: boolean): void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const hintId = useId();
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const select = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++request.current;
    setError("");
    onPending(true);
    try {
      const photo = await preparePhoto(file);
      if (request.current === version) onChange(photo);
    } catch (error) {
      if (request.current === version)
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a foto.",
        );
    } finally {
      if (request.current === version) onPending(false);
    }
  };
  const remove = () => {
    request.current++;
    onPending(false);
    setError("");
    onChange(null);
  };
  return (
    <div className="photo-editor">
      <div className="photo-editor-heading">
        <span>
          <Camera size={16} /> Foto do produto
        </span>
        <span>Opcional</span>
      </div>
      <div className="photo-preview" aria-busy={pending}>
        {value ? (
          <ProductPhoto src={value} alt="Prévia da foto do produto" />
        ) : (
          <div className="photo-placeholder">
            <Camera size={33} strokeWidth={1.4} />
            <strong>Mostre o sabor antes da primeira fatia</strong>
            <span>Adicione uma foto para aparecer no cardápio.</span>
          </div>
        )}
        {pending && (
          <div className="photo-processing" role="status">
            <LoaderCircle size={20} className="spin" /> Preparando foto…
          </div>
        )}
      </div>
      <label
        className="button secondary photo-file-control"
        aria-disabled={disabled}
      >
        <Camera size={16} />
        <span>{value ? "Trocar foto" : "Selecionar foto"}</span>
        <input
          type="file"
          aria-label={value ? "Trocar foto" : "Selecionar foto"}
          aria-describedby={hintId}
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          disabled={disabled}
          onChange={(e) => void select(e)}
        />
      </label>
      <p className="field-hint photo-file-hint" id={hintId}>
        JPG, PNG ou WebP, até 10 MB. A foto é otimizada para até 200 KB antes de
        salvar.
      </p>
      {value && (
        <div className="photo-editor-actions">
          <span>Prévia pronta · salva ao confirmar o produto</span>
          <Button tone="ghost" disabled={disabled} onClick={remove}>
            <Trash2 size={14} /> Remover foto
          </Button>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
