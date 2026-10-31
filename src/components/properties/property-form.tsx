"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Image as ImageIcon, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createProperty, updateProperty } from "@/actions/properties";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AMENITIES, FURNISHING, LISTING_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PropertyFormValues = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  listingType: string;
  status: string;
  price: number;
  area: number | null;
  areaUnit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  address: string | null;
  locality: string | null;
  city: string;
  amenities: string[];
  images: string[];
  ownerName: string | null;
  ownerPhone: string | null;
  featured: boolean;
  agentId: string | null;
};

const AREA_UNITS = [
  { value: "sqft", label: "sq ft" },
  { value: "sqm", label: "sq m" },
  { value: "sqyd", label: "sq yd" },
  { value: "acre", label: "acre" },
];

export function PropertyForm({
  property,
  users,
  currentUserId,
  currency = "INR",
}: {
  property?: PropertyFormValues;
  users: { id: string; name: string }[];
  currentUserId: string;
  currency?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [images, setImages] = useState<string[]>(property?.images ?? []);
  const [imageUrl, setImageUrl] = useState("");
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? []);
  const [price, setPrice] = useState(property?.price ? String(property.price) : "");
  const [listingType, setListingType] = useState(property?.listingType ?? "SALE");
  const [type, setType] = useState(property?.type ?? "APARTMENT");
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const residential = !["PLOT", "OFFICE", "SHOP", "WAREHOUSE"].includes(type);
  const priceNum = Number(price.replace(/,/g, ""));

  const addImage = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Please enter a valid image URL starting with http:// or https://");
      return;
    }
    if (images.includes(url)) {
      toast.error("This image is already added.");
      return;
    }
    setImages((i) => [...i, url]);
    setImageUrl("");
  };

  const toggleAmenity = (a: string) => setAmenities((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));

  const onSubmit = (fd: FormData) => {
    fd.delete("images");
    images.forEach((i) => fd.append("images", i));
    fd.delete("amenities");
    amenities.forEach((a) => fd.append("amenities", a));
    start(async () => {
      const res = property ? await updateProperty(property.id, fd) : await createProperty(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(property ? "Property updated" : "Property added to inventory");
      router.push(`/properties/${res.data?.id ?? property?.id}`);
      router.refresh();
    });
  };

  return (
    <form action={onSubmit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Basic information" description="How the property will appear to your team and clients." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Property title" required className="sm:col-span-2">
              <Input name="title" required defaultValue={property?.title} placeholder="e.g. Sea-facing 3 BHK in Powai" />
            </Field>
            <Field label="Property type" required>
              <Select name="type" options={PROPERTY_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
            </Field>
            <Field label="Listing type" required>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map((l) => (
                  <label
                    key={l.value}
                    className={cn(
                      "flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium transition",
                      listingType === l.value ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10" : "border-slate-300 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <input type="radio" name="listingType" value={l.value} checked={listingType === l.value} onChange={() => setListingType(l.value)} className="sr-only" />
                    {l.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field
              label={listingType === "RENT" ? "Monthly rent" : "Price"}
              required
              hint={priceNum > 0 ? `${formatCompact(priceNum, currency)}${listingType === "RENT" ? " per month" : ""}` : "Enter the full amount"}
            >
              <Input name="price" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="e.g. 14500000" />
            </Field>
            <Field label="Status">
              <Select name="status" options={PROPERTY_STATUSES} defaultValue={property?.status ?? "AVAILABLE"} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea name="description" rows={4} defaultValue={property?.description ?? ""} placeholder="Highlights, connectivity, nearby landmarks, payment plans..." />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Specifications" />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Area" className="lg:col-span-1">
              <Input name="area" inputMode="decimal" defaultValue={property?.area ?? ""} placeholder="1200" />
            </Field>
            <Field label="Unit">
              <Select name="areaUnit" options={AREA_UNITS} defaultValue={property?.areaUnit ?? "sqft"} />
            </Field>
            {residential && (
              <>
                <Field label="Bedrooms">
                  <Input name="bedrooms" type="number" min={0} max={20} defaultValue={property?.bedrooms ?? ""} placeholder="3" />
                </Field>
                <Field label="Bathrooms">
                  <Input name="bathrooms" type="number" min={0} max={20} defaultValue={property?.bathrooms ?? ""} placeholder="2" />
                </Field>
                <Field label="Furnishing" className="sm:col-span-2">
                  <Select name="furnishing" options={FURNISHING} placeholder="Not specified" defaultValue={property?.furnishing ?? ""} />
                </Field>
              </>
            )}
          </div>
          <div className="border-t border-slate-100 p-5">
            <p className="label">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                      on ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Location" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="City" required>
              <Input name="city" required defaultValue={property?.city} placeholder="Mumbai" />
            </Field>
            <Field label="Locality">
              <Input name="locality" defaultValue={property?.locality ?? ""} placeholder="Powai" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input name="address" defaultValue={property?.address ?? ""} placeholder="Building, street, landmark" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Photos" description="Paste image links. The first photo is used as the cover." />
          <div className="p-5">
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
                placeholder="https://example.com/photo.jpg"
              />
              <Button variant="secondary" onClick={addImage}>
                <ImagePlus /> Add
              </Button>
            </div>
            {images.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 text-center">
                <ImageIcon className="size-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No photos added yet</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((src, i) => (
                  <div key={src} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {broken[src] ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">Preview unavailable</div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [src]: true }))} />
                    )}
                    {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-medium text-white">Cover</span>}
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {i > 0 && (
                        <button
                          type="button"
                          title="Make cover"
                          onClick={() => setImages((list) => [src, ...list.filter((x) => x !== src)])}
                          className="rounded-md bg-white/90 p-1.5 text-slate-700 shadow-xs hover:bg-white"
                        >
                          <Star className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => setImages((list) => list.filter((x) => x !== src))}
                        className="rounded-md bg-white/90 p-1.5 text-rose-600 shadow-xs hover:bg-white"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Assignment" />
          <div className="space-y-4 p-5">
            <Field label="Listing agent">
              <Select name="agentId" options={users.map((u) => ({ value: u.id, label: u.name }))} defaultValue={property ? (property.agentId ?? "") : currentUserId} placeholder="Unassigned" />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input type="checkbox" name="featured" defaultChecked={property?.featured} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium text-slate-800">Featured listing</span>
                <span className="block text-xs text-slate-500">Highlight this property across the CRM.</span>
              </span>
            </label>
          </div>
        </Card>
        <Card>
          <CardHeader title="Owner details" description="Visible only to your team." />
          <div className="space-y-4 p-5">
            <Field label="Owner name">
              <Input name="ownerName" defaultValue={property?.ownerName ?? ""} placeholder="Full name" />
            </Field>
            <Field label="Owner phone">
              <Input name="ownerPhone" type="tel" defaultValue={property?.ownerPhone ?? ""} placeholder="98xxxxxxxx" />
            </Field>
          </div>
        </Card>
        <div className="sticky top-20 flex gap-2">
          <LinkButton href={property ? `/properties/${property.id}` : "/properties"} variant="secondary" className="flex-1">
            Cancel
          </LinkButton>
          <Button type="submit" loading={pending} className="flex-1">
            {property ? "Save changes" : "Add property"}
          </Button>
        </div>
      </div>
    </form>
  );
}
