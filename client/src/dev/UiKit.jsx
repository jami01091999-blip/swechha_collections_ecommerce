// Dev-only gallery of the UI kit at /__ui. Never shipped: App.jsx only imports it when
// import.meta.env.DEV is true, and tailwind.config.js does not scan this folder for production CSS.
import { useState } from 'react';
import Icon from '../components/shared/Icon';
import { CodeStep, EmailStep, NameStep } from '../pages/public/Login';
import { NoAdminAccess } from '../components/admin/AdminGuard';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  EmptyState,
  Field,
  IconButton,
  Input,
  OtpInput,
  PageContainer,
  PriceBlock,
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Spinner,
  StatusChip,
  Stepper,
  StockStateChip,
  Switch,
  Textarea,
  ToneChip,
  Avatar,
  initials,
} from '../components/ui';

function Block({ title, children }) {
  return (
    <Card as="section" className="space-y-3">
      <h2 className="font-headline-sm text-[18px] leading-tight text-primary">{title}</h2>
      {children}
    </Card>
  );
}

const Row = ({ children }) => <div className="flex flex-wrap items-center gap-2">{children}</div>;

export default function UiKit() {
  const [chip, setChip] = useState('Sarees');
  const [seg, setSeg] = useState('sized');
  const [on, setOn] = useState(true);
  const [qty, setQty] = useState(2);
  const [otp, setOtp] = useState('');
  const [done, setDone] = useState('');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loginEmail, setLoginEmail] = useState('ana@example.com');

  return (
    <div className="admin-root bg-background text-on-surface min-h-screen pb-16">
      <PageContainer as="main" className="px-gutter-mobile pt-6 space-y-4">
        <SectionHeader title="UI kit" subtitle="Every shared component in every state. Dev server only." />

        <Block title="Button">
          {['primary', 'secondary', 'danger', 'whatsapp', 'ghost'].map((v) => (
            <Row key={v}>
              {['sm', 'md', 'lg'].map((s) => (
                <Button key={s} variant={v} size={s} className={v === 'ghost' ? '' : 'px-4'}>
                  {v === 'whatsapp' && <Icon name="chat" className="text-xl" />}
                  {v} {s}
                </Button>
              ))}
              {v !== 'ghost' && (
                <Button variant={v} className="px-4" disabled>
                  disabled
                </Button>
              )}
            </Row>
          ))}
        </Block>

        <Block title="IconButton">
          <Row>
            <IconButton
              icon="menu"
              label="Menu"
              size="lg"
              className="text-primary hover:bg-surface-container-high"
              iconClassName="text-2xl"
            />
            <IconButton icon="arrow_back" label="Back" className="text-primary hover:bg-surface-container" iconClassName="text-2xl" />
            <IconButton icon="share" label="Share" className="text-on-surface hover:text-primary" iconClassName="text-xl" />
          </Row>
        </Block>

        <Block title="Chip">
          {['category', 'filter', 'toggle', 'size'].map((kind) => (
            <Row key={kind}>
              {['Sarees', 'Lehengas', 'Kurti'].map((c) => (
                <Chip key={c} kind={kind} active={chip === c} onClick={() => setChip(c)} aria-pressed={chip === c}>
                  {kind === 'size' ? c.slice(0, 1) : c}
                </Chip>
              ))}
            </Row>
          ))}
        </Block>

        <Block title="ToneChip · StatusChip · StockStateChip">
          <Row>
            {['red', 'amber', 'green', 'grey'].map((t) => (
              <ToneChip key={t} tone={t}>
                {t}
              </ToneChip>
            ))}
          </Row>
          <Row>
            <StatusChip status="published" />
            <StatusChip status="draft" />
            <StockStateChip stock={0} limit={2} />
            <StockStateChip stock={1} limit={2} />
            <StockStateChip stock={9} limit={2} />
          </Row>
        </Block>

        <Block title="Field · Input · Textarea · Select">
          <Field label="Product name" required htmlFor="ui-name" hint="Shown on product cards.">
            <Input id="ui-name" placeholder="e.g. Gulmohar Silk Saree" />
          </Field>
          <Field label="Selling price (₹)" required htmlFor="ui-price" error="Selling price must be more than 0.">
            <Input id="ui-price" type="number" invalid defaultValue="0" />
          </Field>
          <Field label="Description" htmlFor="ui-desc">
            <Textarea id="ui-desc" rows={3} placeholder="Tell the story of the weave…" />
          </Field>
          <Field label="Category" htmlFor="ui-cat">
            <Select id="ui-cat" defaultValue="Sarees">
              <option>Sarees</option>
              <option>Lehengas</option>
            </Select>
          </Field>
          <Input disabled placeholder="Disabled" />
        </Block>

        <Block title="Segmented · Switch · Stepper">
          <Segmented
            label="Size type"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'sized', label: 'Sized' },
              { value: 'free', label: 'Free Size' },
            ]}
          />
          <Switch checked={on} onChange={setOn} label="Mark as New Arrival" hint="Shows in New Arrivals with a “New” badge." />
          <Stepper label="M" value={qty} onChange={setQty} />
        </Block>

        <Block title="Sign-in screens (/login)">
          <p className="font-body-sm text-[12px] text-on-surface-variant">Buttons here call the real API on the dev server.</p>
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            <EmailStep email={loginEmail} setEmail={setLoginEmail} onSent={() => {}} />
            <EmailStep email="nope" setEmail={() => {}} onSent={() => {}} initialError="Enter a valid email address." />
            <CodeStep email={loginEmail} resendIn={42} onChangeEmail={() => {}} onVerified={() => {}} />
            <CodeStep
              email={loginEmail}
              resendIn={0}
              onChangeEmail={() => {}}
              onVerified={() => {}}
              initialError="That code isn't right. 3 tries left."
            />
            <CodeStep
              email={loginEmail}
              resendIn={0}
              onChangeEmail={() => {}}
              onVerified={() => {}}
              initialError="Too many wrong tries. Ask for a new code."
            />
            <NameStep onDone={() => {}} />
          </div>
        </Block>

        <Block title="Avatar · no admin access">
          <Row>
            <Avatar>{initials({ name: 'Divya Rao' })}</Avatar>
            <Avatar>{initials({ email: 'ana@example.com' })}</Avatar>
          </Row>
          <NoAdminAccess email="ana@example.com" />
        </Block>

        <Block title="OtpInput">
          <OtpInput value={otp} onChange={setOtp} onComplete={setDone} />
          <p className="font-body-sm text-[12px] text-on-surface-variant text-center">
            {done ? `Completed: ${done}` : 'Type or paste a 6-digit code.'}
          </p>
          <OtpInput value="123" onChange={() => {}} invalid label="Invalid code" />
          <OtpInput value="123456" onChange={() => {}} disabled label="Disabled code" />
        </Block>

        <Block title="PriceBlock">
          <div className="grid grid-cols-2 gap-3">
            <PriceBlock variant="rail" price={12800} mrp={18000} />
            <PriceBlock variant="rail" price={12800} mrp={0} />
            <PriceBlock variant="grid" price={14500} mrp={24000} />
            <PriceBlock variant="grid" price={14500} mrp={14500} />
          </div>
          <PriceBlock variant="pdp" price={38000} mrp={52000} />
          <PriceBlock variant="pdp" price={38000} mrp={0} />
        </Block>

        <Block title="Skeleton · Spinner">
          <Row>
            <Skeleton className="w-14 h-16 rounded-lg" />
            <Skeleton tone="low" className="w-14 h-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <Spinner />
          </Row>
        </Block>

        <Block title="EmptyState">
          <EmptyState icon="search_off" title="No designs match" body="Try another word or clear the filters.">
            <Button variant="ghost" size="sm" className="mt-3">
              Clear filters
            </Button>
          </EmptyState>
        </Block>

        <Block title="SectionHeader">
          <SectionHeader
            title="New Arrivals"
            subtitle="Fresh artisanal weavings"
            action={
              <Button variant="ghost" size="sm">
                View all
              </Button>
            }
          />
          <SectionHeader title="Shop by Category" subtitle="Without an action" />
        </Block>

        <Block title="Sheet · ConfirmSheet">
          <Row>
            <Button variant="secondary" size="sm" className="px-4" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <Button variant="danger" size="sm" className="px-4" onClick={() => setConfirm(true)}>
              Open confirm
            </Button>
          </Row>
        </Block>
      </PageContainer>

      {sheet && (
        <Sheet label="Example sheet" onClose={() => setSheet(false)}>
          <h2 className="font-headline-sm text-headline-sm text-primary">Bottom sheet</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Slides up on phones, centred dialog from md:.</p>
          <Button size="lg" className="w-full mt-4" onClick={() => setSheet(false)}>
            Done
          </Button>
        </Sheet>
      )}
      {confirm && (
        <ConfirmSheet
          title="Delete this design?"
          body="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => setConfirm(false)}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
