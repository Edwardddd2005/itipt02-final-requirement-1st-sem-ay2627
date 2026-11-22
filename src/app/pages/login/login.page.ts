
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { musicalNotes } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon
  ]
})
export class LoginPage {

  email = '';
  password = '';

  // FASTAPI BACKEND URL
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private router: Router) {
    addIcons({ musicalNotes });
  }

  async login() {

    if (!this.email.trim() || !this.password) {
      alert('Ilagay ang iyong email at password.');
      return;
    }

    try {

      const response = await fetch(
        `${this.apiUrl}/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: this.email.trim(),
            password: this.password
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || 'Login failed.');
        console.error('Login response:', result);
        return;
      }

      // CHECK USER INFORMATION
      if (
        !result.user ||
        !result.user.user_id ||
        !result.user.username
      ) {
        alert('Hindi nakuha ang user information mula sa backend.');
        console.error('Login response:', result);
        return;
      }

      // SAVE LOGGED-IN USER
      localStorage.setItem(
        'melodifyUser',
        JSON.stringify(result.user)
      );

      console.log(
        'Saved user:',
        localStorage.getItem('melodifyUser')
      );

      alert(result.message || 'Login successful!');

      // GO TO HOME
      await this.router.navigateByUrl('/home');

    } catch (error) {

      console.error('Login error:', error);

      alert(
        'Hindi makakonekta sa FastAPI backend. Tiyaking tumatakbo ang Uvicorn sa port 8000.'
      );

    }

  }

}
