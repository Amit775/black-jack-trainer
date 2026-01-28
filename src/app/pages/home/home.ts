import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField } from '@angular/forms/signals';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { BlackjackStore } from '../../store';

interface BalanceFormModel {
  depositAmount: number;
  withdrawAmount: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormField,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(BlackjackStore);

  // Signal-based form model
  protected readonly formModel = signal<BalanceFormModel>({
    depositAmount: 100,
    withdrawAmount: 0,
  });
  protected readonly balanceForm = form(this.formModel);

  protected readonly balance = computed(() => this.store.balance());

  deposit(): void {
		const { depositAmount } = this.formModel();
    if (depositAmount > 0) {
      this.store.deposit(depositAmount);
      this.balanceForm.depositAmount().value.set(100);
    }
  }

  withdraw(): void {
    const { withdrawAmount } = this.formModel();
    if (withdrawAmount > 0 && withdrawAmount <= this.balance()) {
      this.store.withdraw(withdrawAmount);
      this.balanceForm.withdrawAmount().value.set(0);
    }
  }

  withdrawAll(): void {
    if (this.balance() > 0) {
      this.store.withdraw(this.balance());
    }
  }

  navigateToPlay(): void {
    this.router.navigate(['/play']);
  }
}
